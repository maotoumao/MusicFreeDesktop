/**
 * PlayQueue — 播放队列管理
 *
 * 内存中维护 slim 列表供 UI 渲染，
 * 通过 MutationQueue + musicSheet preload IPC 持久化到 SQLite 虚拟歌单。
 * 乐观更新：先改内存 → 再异步落库。
 */
import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
import { compositeKey, isSameMedia } from '@common/mediaKey';
import { createIndexMap, type IIndexMap } from '@common/indexMap';
import musicItemToSlim from '@common/musicItemToSlim';
import MutationQueue from '@common/mutationQueue';
import { syncKV } from '@renderer/common/kvStore';
import { playQueueBridge } from '@infra/musicSheet/renderer';
import { store, musicQueueAtom } from './store';

// ─── PlayQueue ───

class PlayQueue {
    /** 内存中的 slim 列表（用于 UI 渲染） */
    private slimList: IMusicItemSlim[] = [];
    private indexMap: IIndexMap = createIndexMap([]);
    private currentIndex = -1;
    private mutationQueue = new MutationQueue();

    // ─── Shuffle 状态（虚拟导航，纯内存，不持久化） ───
    private shuffleKeys: string[] = [];
    private shufflePosition = -1;
    private _isShuffleActive = false;
    private keyToIndex = new Map<string, number>();

    constructor() {
        this.mutationQueue.onError(() => {
            // 持久化失败时从主进程重新加载
            this.reloadFromDB();
        });
    }

    // ─── 读取 ───

    get queue(): IMusicItemSlim[] {
        return this.slimList;
    }

    get isEmpty(): boolean {
        return this.slimList.length === 0;
    }

    getCurrentIndex(): number {
        return this.currentIndex;
    }

    getCurrentMusic(): IMusicItemSlim | null {
        return this.currentIndex >= 0 ? (this.slimList[this.currentIndex] ?? null) : null;
    }

    get isShuffleActive(): boolean {
        return this._isShuffleActive;
    }

    // ─── 初始化（启动恢复） ───

    async setup(): Promise<void> {
        this.slimList = await playQueueBridge.getAll();
        this.rebuildIndexMap();

        const savedMusic = syncKV.get('player.currentMusic');
        if (savedMusic) {
            this.currentIndex = this.indexMap.indexOf(savedMusic);
        }
        this.syncAtom();
    }

    // ─── 队列操作（乐观更新 + MutationQueue） ───

    /**
     * 替换整个队列。
     * @param items   歌曲列表（IMusicItem 或 IMusicItemSlim 均可）
     * @param options.playIndex    起始播放位置
     * @param options.fromSheetId  可选性能优化提示：若来自某本地歌单，主进程用 INSERT...SELECT
     */
    setQueue(
        items: (IMusic.IMusicItem | IMusicItemSlim)[],
        options?: { playIndex?: number; fromSheetId?: string },
    ): void {
        const slims = items.map(musicItemToSlim);
        this.slimList = slims;
        this.rebuildIndexMap();
        this.currentIndex = options?.playIndex ?? -1;
        if (this._isShuffleActive) this.regenerateShuffleOrder();
        this.syncAtom();

        this.mutationQueue.enqueue(() =>
            playQueueBridge.set(items as IMusic.IMusicItem[], options?.fromSheetId),
        );
    }

    /**
     * 下一首播放。
     * 将指定歌曲移到当前歌曲之后（已存在则先移除再插入）。
     * Shuffle 模式下同时更新 shuffle 导航，确保新歌曲在随机序列的下一位。
     */
    addNext(items: (IMusic.IMusicItem | IMusicItemSlim)[]): void {
        const slims = items.map(musicItemToSlim);
        const currentMusic = this.getCurrentMusic();
        const currentKey = currentMusic ? this.keyOf(currentMusic) : null;

        // 单次遍历：过滤当前播放歌曲，同时保留对应 items 索引
        const filteredSlims: IMusicItemSlim[] = [];
        const filteredItems: IMusic.IMusicItem[] = [];
        for (let i = 0; i < slims.length; i++) {
            if (currentKey && this.keyOf(slims[i]) === currentKey) continue;
            filteredSlims.push(slims[i]);
            filteredItems.push(items[i] as IMusic.IMusicItem);
        }

        if (filteredSlims.length === 0) return;

        // 去重：从队列中移除即将插入的歌曲
        const removeSet = new Set(filteredSlims.map((s) => this.keyOf(s)));
        const cleaned = this.slimList.filter((s) => !removeSet.has(this.keyOf(s)));

        // 计算插入点：当前歌曲之后
        const cleanedCurrentIdx = currentMusic
            ? cleaned.findIndex((s) => isSameMedia(s, currentMusic))
            : -1;
        const insertPos = cleanedCurrentIdx + 1;
        cleaned.splice(insertPos, 0, ...filteredSlims);
        this.slimList = cleaned;
        this.rebuildIndexMap();
        this.fixCurrentIndex(currentMusic);

        // 更新 shuffle 导航
        if (this._isShuffleActive) {
            this.shuffleKeys = this.shuffleKeys.filter((k) => !removeSet.has(k));
            if (currentKey) {
                const pos = this.shuffleKeys.indexOf(currentKey);
                if (pos !== -1) this.shufflePosition = pos;
            }
            const newKeys = filteredSlims.map((s) => this.keyOf(s));
            this.shuffleKeys.splice(this.shufflePosition + 1, 0, ...newKeys);
        }

        this.syncAtom();
        this.mutationQueue.enqueue(() => playQueueBridge.add(filteredItems, insertPos));
    }

    /** 追加到队尾 */
    append(items: (IMusic.IMusicItem | IMusicItemSlim)[]): void {
        const slims = items.map(musicItemToSlim);
        this.slimList = [...this.slimList, ...slims];
        this.rebuildIndexMap();
        if (this._isShuffleActive) {
            this.shuffleKeys.push(...slims.map((s) => this.keyOf(s)));
        }
        this.syncAtom();

        // afterIndex 超出范围时主进程自动 append
        this.mutationQueue.enqueue(() =>
            playQueueBridge.add(items as IMusic.IMusicItem[], this.slimList.length),
        );
    }

    /** 移除指定歌曲 */
    remove(targets: IMedia.IMediaBase | IMedia.IMediaBase[]): void {
        const bases = Array.isArray(targets) ? targets : [targets];
        const removeSet = new Set(bases.map((b) => this.keyOf(b)));

        const currentMusic = this.getCurrentMusic();
        this.slimList = this.slimList.filter((s) => !removeSet.has(this.keyOf(s)));
        this.rebuildIndexMap();

        if (currentMusic && removeSet.has(this.keyOf(currentMusic))) {
            this.currentIndex = -1;
        } else {
            this.fixCurrentIndex(currentMusic);
        }

        if (this._isShuffleActive) {
            this.shuffleKeys = this.shuffleKeys.filter((k) => !removeSet.has(k));
            if (this.currentIndex >= 0) {
                const key = this.keyOf(this.slimList[this.currentIndex]);
                this.shufflePosition = this.shuffleKeys.indexOf(key);
            } else {
                this.shufflePosition = -1;
            }
        }
        this.syncAtom();

        this.mutationQueue.enqueue(() => playQueueBridge.remove(bases));
    }

    /** 清空 */
    clear(): void {
        this.slimList = [];
        this.currentIndex = -1;
        this.shuffleKeys = [];
        this.shufflePosition = -1;
        this.rebuildIndexMap();
        this.syncAtom();

        this.mutationQueue.enqueue(() => playQueueBridge.clear());
    }

    // ─── 导航 ───

    setCurrentIndex(index: number): void {
        this.currentIndex = index;
        if (this._isShuffleActive && index >= 0 && index < this.slimList.length) {
            const key = this.keyOf(this.slimList[index]);
            const pos = this.shuffleKeys.indexOf(key);
            if (pos !== -1) this.shufflePosition = pos;
        }
    }

    getNextIndex(): number {
        if (this.isEmpty) return -1;
        if (this._isShuffleActive && this.shuffleKeys.length > 0) {
            const nextPos = (this.shufflePosition + 1) % this.shuffleKeys.length;
            return this.indexOfKey(this.shuffleKeys[nextPos]);
        }
        return (this.currentIndex + 1) % this.slimList.length;
    }

    getPrevIndex(): number {
        if (this.isEmpty) return -1;
        if (this._isShuffleActive && this.shuffleKeys.length > 0) {
            const prevPos =
                (this.shufflePosition - 1 + this.shuffleKeys.length) % this.shuffleKeys.length;
            return this.indexOfKey(this.shuffleKeys[prevPos]);
        }
        return (this.currentIndex - 1 + this.slimList.length) % this.slimList.length;
    }

    findIndex(item: IMedia.IMediaBase): number {
        return this.indexMap.indexOf(item);
    }

    // ─── Shuffle（虚拟导航） ───

    /** 进入 Shuffle 模式：生成随机导航序列，当前歌曲置首 */
    enterShuffle(): void {
        this._isShuffleActive = true;
        this.regenerateShuffleOrder();
    }

    /** 退出 Shuffle 模式：清空导航序列 */
    exitShuffle(): void {
        this.shuffleKeys = [];
        this.shufflePosition = -1;
        this._isShuffleActive = false;
    }

    // ─── 内部方法 ───

    private rebuildIndexMap(): void {
        this.indexMap = createIndexMap(this.slimList);
        this.keyToIndex.clear();
        for (let i = 0; i < this.slimList.length; i++) {
            this.keyToIndex.set(this.keyOf(this.slimList[i]), i);
        }
    }

    private keyOf(item: IMusicItemSlim | IMedia.IMediaBase): string {
        return compositeKey(item.platform, item.id);
    }

    private indexOfKey(key: string): number {
        return this.keyToIndex.get(key) ?? -1;
    }

    /** 生成随机导航序列，当前歌曲置首 */
    private regenerateShuffleOrder(): void {
        const n = this.slimList.length;
        if (n === 0) {
            this.shuffleKeys = [];
            this.shufflePosition = -1;
            return;
        }

        const currentKey =
            this.currentIndex >= 0 ? this.keyOf(this.slimList[this.currentIndex]) : null;
        const allKeys = this.slimList.map((s) => this.keyOf(s));
        const rest = currentKey ? allKeys.filter((k) => k !== currentKey) : [...allKeys];

        // Fisher-Yates in-place shuffle
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
        }

        this.shuffleKeys = currentKey ? [currentKey, ...rest] : rest;
        this.shufflePosition = currentKey ? 0 : -1;
    }

    /**
     * 重定位 currentIndex。
     * @param currentMusic 已捕获的当前歌曲引用（避免读 localStorage）
     *   仅在 reloadFromDB 等无法提前捕获的场景传 undefined，此时回退到 localStorage。
     */
    private fixCurrentIndex(currentMusic?: IMusicItemSlim | null): void {
        const target = currentMusic ?? syncKV.get('player.currentMusic');
        if (target) {
            this.currentIndex = this.indexMap.indexOf(target);
        }
    }

    private syncAtom(): void {
        store.set(musicQueueAtom, this.slimList);
    }

    private async reloadFromDB(): Promise<void> {
        try {
            this.slimList = await playQueueBridge.getAll();
            this.rebuildIndexMap();
            this.fixCurrentIndex();
            if (this._isShuffleActive) this.regenerateShuffleOrder();
            this.syncAtom();
        } catch {
            // 静默失败，下次操作会重试
        }
    }
}

export default PlayQueue;
