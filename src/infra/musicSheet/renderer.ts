/**
 * musicSheet — Renderer 层
 *
 * 职责：
 * - 管理歌单/歌曲的内存缓存，提供同步读取 API
 * - 乐观更新 + MutationQueue 串行异步持久化
 * - Favorite Set 本地缓存（同步 O(1) 判断）
 * - 提供 React Hooks（jotai atom）
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { atom, getDefaultStore } from 'jotai';
import { useAtomValue } from 'jotai/react';
import EventEmitter from 'eventemitter3';

import type {
    ILocalSheetMeta,
    ILocalSheetDetail,
    IMusicItemSlim,
    ICreateSheetParams,
    IUpdateSheetParams,
    IStarredSheetItem,
} from '@appTypes/infra/musicSheet';

import { compositeKey } from '@common/mediaKey';
import musicItemToSlim from '@common/musicItemToSlim';
import MutationQueue from '@common/mutationQueue';
import {
    CONTEXT_BRIDGE_KEY,
    DEFAULT_FAVORITE_SHEET_ID,
    type IMusicSheetEvent,
} from './common/constant';

// ─── Preload Bridge ───

interface IMod {
    getAllSheets(): Promise<ILocalSheetMeta[]>;
    getSheetDetail(sheetId: string): Promise<ILocalSheetDetail | null>;
    createSheet(params: ICreateSheetParams): Promise<ILocalSheetMeta>;
    deleteSheet(sheetId: string): Promise<void>;
    updateSheet(params: IUpdateSheetParams): Promise<void>;
    clearSheet(sheetId: string): Promise<void>;
    addMusic(
        sheetId: string,
        musicItems: IMusic.IMusicItem[],
    ): Promise<{ added: number; truncated: number }>;
    removeMusic(sheetId: string, musicBases: IMedia.IMediaBase[]): Promise<void>;
    removeFromAllSheets(musicBases: IMedia.IMediaBase[]): Promise<void>;
    updateMusicOrder(sheetId: string, orderedKeys: IMedia.IMediaBase[]): Promise<void>;
    getRawMusicItem(platform: string, id: string): Promise<IMusic.IMusicItem | null>;
    getRawMusicItems(keys: IMedia.IMediaBase[]): Promise<IMusic.IMusicItem[]>;
    getStarredSheets(): Promise<IStarredSheetItem[]>;
    starSheet(sheet: IMusic.IMusicSheetItem): Promise<void>;
    unstarSheet(platform: string, id: string): Promise<void>;
    setStarredOrder(orderedKeys: IMedia.IMediaBase[]): Promise<void>;
    // ─── 播放队列 ───
    playQueueGetAll(): Promise<IMusicItemSlim[]>;
    playQueueSet(items: IMusic.IMusicItem[], fromSheetId?: string): Promise<void>;
    playQueueAdd(items: IMusic.IMusicItem[], afterIndex: number): Promise<void>;
    playQueueRemove(musicBases: IMedia.IMediaBase[]): Promise<void>;
    playQueueClear(): Promise<void>;
    // ─── 事件 ───
    onMusicSheetEvent(cb: (event: IMusicSheetEvent) => void): () => void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── PlayQueue Bridge（供 trackPlayer/playQueue 直接消费） ───

export const playQueueBridge = {
    getAll: mod.playQueueGetAll.bind(mod),
    set: mod.playQueueSet.bind(mod),
    add: mod.playQueueAdd.bind(mod),
    remove: mod.playQueueRemove.bind(mod),
    clear: mod.playQueueClear.bind(mod),
} as const;

export type IPlayQueueBridge = typeof playQueueBridge;

// ─── State (Jotai) ───

const store = getDefaultStore();

/** 歌单列表 */
const sheetsAtom = atom<ILocalSheetMeta[]>([]);

/** 星标远程歌单 */
const starredSheetsAtom = atom<IStarredSheetItem[]>([]);

/** 当前歌曲列表 */
const musicListAtom = atom<IMusicItemSlim[]>([]);

/** 正在加载歌单详情 */
const isLoadingSheetAtom = atom(false);

// ═══════════════════════════════════════════════════════
// MusicSheetRenderer
// ═══════════════════════════════════════════════════════

interface IRendererEvents {
    error: (e: Error) => void;
    favoriteChange: () => void;
    starredChange: () => void;
}

class MusicSheetRenderer {
    static instance: MusicSheetRenderer | null = null;

    public readonly events = new EventEmitter<IRendererEvents>();
    private favoriteIdSet = new Set<string>();
    private starredIdSet = new Set<string>();
    private currentSheetId: string | null = null;
    private mutationQueue = new MutationQueue();

    constructor() {
        this.mutationQueue.onError(async (e) => {
            await this.reloadState();
            this.events.emit('error', e);
        });
    }

    // ─── 初始化 ───

    async setup() {
        if (MusicSheetRenderer.instance) return;
        MusicSheetRenderer.instance = this;

        const [sheets, starred] = await Promise.all([mod.getAllSheets(), mod.getStarredSheets()]);
        store.set(sheetsAtom, sheets);
        store.set(starredSheetsAtom, starred);

        this.starredIdSet = new Set(starred.map((s) => compositeKey(s.platform, s.id)));

        await this.refreshFavoriteCache();

        mod.onMusicSheetEvent(async (event) => {
            try {
                // sheetsAtom 始终刷新（轻量 getAllSheets 查询，同步 worksNum 等元数据）
                store.set(sheetsAtom, await mod.getAllSheets());

                // internal 事件：main 侧内部模块主动变更了歌曲列表，renderer 无乐观更新，需拉取
                // user 事件：renderer 自己发起的操作，乐观更新已处理，跳过
                if (event.origin === 'internal') {
                    await this.syncInternalChange(event.sheetId);
                }
            } catch (e) {
                this.events.emit('error', e instanceof Error ? e : new Error(String(e)));
            }
        });
    }

    /** 注册错误回调（用于业务层弹 toast） */
    onError(cb: (e: Error) => void): () => void {
        this.events.on('error', cb);
        return () => this.events.off('error', cb);
    }

    // ─── 内部恢复 ───

    async reloadState() {
        if (this.currentSheetId) {
            const detail = await mod.getSheetDetail(this.currentSheetId);
            if (detail) store.set(musicListAtom, detail.musicList);
        }
        await this.refreshFavoriteCache();
    }

    // ─── 歌单列表 ───

    getAllSheets(): ILocalSheetMeta[] {
        return store.get(sheetsAtom);
    }

    // NOTE: IPC 完成后手动刷新 sheetsAtom，保证调用者 resolve 时数据已是最新。
    // main 侧广播会再触发一次 getAllSheets（双重拉取），但开销可忽略。

    async addSheet(title: string): Promise<ILocalSheetMeta> {
        const sheet = await mod.createSheet({ title });
        store.set(sheetsAtom, await mod.getAllSheets());
        return sheet;
    }

    // NOTE: 双重拉取，见 addSheet 注释
    async removeSheet(sheetId: string): Promise<void> {
        await mod.deleteSheet(sheetId);
        store.set(sheetsAtom, await mod.getAllSheets());
    }

    // NOTE: 双重拉取，见 addSheet 注释
    async updateSheet(sheetId: string, data: Partial<IUpdateSheetParams>): Promise<void> {
        await mod.updateSheet({ id: sheetId, ...data });
        store.set(sheetsAtom, await mod.getAllSheets());
    }

    clearSheet(sheetId: string): void {
        // 乐观更新
        if (this.currentSheetId === sheetId) {
            store.set(musicListAtom, []);
        }
        if (sheetId === DEFAULT_FAVORITE_SHEET_ID) {
            this.favoriteIdSet.clear();
            this.events.emit('favoriteChange');
        }
        this.mutationQueue.enqueue(() => mod.clearSheet(sheetId));
    }

    // ─── 歌曲操作（乐观更新 + 队列写入） ───

    addMusicToSheet(
        musicItems: IMusic.IMusicItem | IMusicItemSlim | Array<IMusic.IMusicItem | IMusicItemSlim>,
        sheetId: string,
    ): void {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const slimItems = items.map(musicItemToSlim);

        // 乐观更新：本地数组
        if (this.currentSheetId === sheetId) {
            const list = store.get(musicListAtom);
            const existingKeys = new Set(list.map((m) => compositeKey(m.platform, m.id)));
            const newSlims = slimItems.filter(
                (m) => !existingKeys.has(compositeKey(m.platform, m.id)),
            );
            if (newSlims.length > 0) {
                store.set(musicListAtom, [...newSlims, ...list]);
            }
        }

        // 乐观更新：favorite Set
        if (sheetId === DEFAULT_FAVORITE_SHEET_ID) {
            for (const m of slimItems) {
                this.favoriteIdSet.add(compositeKey(m.platform, m.id));
            }
            this.events.emit('favoriteChange');
        }

        this.mutationQueue.enqueue(() => mod.addMusic(sheetId, items).then(() => {}));
    }

    addMusicToFavorite(
        musicItems: IMusic.IMusicItem | IMusicItemSlim | Array<IMusic.IMusicItem | IMusicItemSlim>,
    ): void {
        this.addMusicToSheet(musicItems, DEFAULT_FAVORITE_SHEET_ID);
    }

    removeMusicFromSheet(
        musicItems: IMedia.IMediaBase | IMedia.IMediaBase[],
        sheetId: string,
    ): void {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const removeSet = new Set(items.map((it) => compositeKey(it.platform, it.id)));

        if (this.currentSheetId === sheetId) {
            store.set(musicListAtom, (prev) =>
                prev.filter((m) => !removeSet.has(compositeKey(m.platform, m.id))),
            );
        }

        if (sheetId === DEFAULT_FAVORITE_SHEET_ID) {
            for (const it of items) {
                this.favoriteIdSet.delete(compositeKey(it.platform, it.id));
            }
            this.events.emit('favoriteChange');
        }

        const bases = items.map((it) => ({ platform: it.platform, id: it.id }));
        this.mutationQueue.enqueue(() => mod.removeMusic(sheetId, bases));
    }

    removeMusicFromFavorite(musicItems: IMedia.IMediaBase | IMedia.IMediaBase[]): void {
        this.removeMusicFromSheet(musicItems, DEFAULT_FAVORITE_SHEET_ID);
    }

    /**
     * 从所有歌单中移除歌曲（排除播放队列，由 trackPlayer 自行管理）。
     * 乐观更新当前 musicListAtom + favoriteIdSet。
     */
    removeFromAllSheets(musicItems: IMedia.IMediaBase | IMedia.IMediaBase[]): void {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const removeSet = new Set(items.map((it) => compositeKey(it.platform, it.id)));

        store.set(musicListAtom, (prev) =>
            prev.filter((m) => !removeSet.has(compositeKey(m.platform, m.id))),
        );

        for (const it of items) {
            this.favoriteIdSet.delete(compositeKey(it.platform, it.id));
        }
        this.events.emit('favoriteChange');

        const bases = items.map((it) => ({ platform: it.platform, id: it.id }));
        this.mutationQueue.enqueue(() => mod.removeFromAllSheets(bases));
    }

    updateMusicOrder(sheetId: string, orderedMusicList: IMusicItemSlim[]): void {
        if (this.currentSheetId === sheetId) {
            store.set(musicListAtom, [...orderedMusicList]);
        }
        const keys = orderedMusicList.map((m) => ({ platform: m.platform, id: m.id }));
        this.mutationQueue.enqueue(() => mod.updateMusicOrder(sheetId, keys));
    }

    // ─── 原始数据读取 ───

    getRawMusicItem(platform: string, id: string): Promise<IMusic.IMusicItem | null> {
        return mod.getRawMusicItem(platform, id);
    }

    getRawMusicItems(keys: IMedia.IMediaBase[]): Promise<IMusic.IMusicItem[]> {
        return mod.getRawMusicItems(keys);
    }

    // ─── 星标远程歌单 ───
    // TODO [P2]: 乐观更新 — 先同步更新 starredIdSet + starredSheetsAtom，再异步写 DB，
    //            失败时回滚（与 favorite 路径一致）。当前实现等待两次 IPC 后才更新 UI。

    getAllStarredSheets(): IStarredSheetItem[] {
        return store.get(starredSheetsAtom);
    }

    async starMusicSheet(sheet: IMusic.IMusicSheetItem): Promise<void> {
        try {
            await mod.starSheet(sheet);
            store.set(starredSheetsAtom, await mod.getStarredSheets());
            this.starredIdSet.add(compositeKey(sheet.platform, String(sheet.id)));
            this.events.emit('starredChange');
        } catch (e) {
            this.events.emit('error', e instanceof Error ? e : new Error(String(e)));
        }
    }

    async unstarMusicSheet(sheet: IMedia.IMediaBase): Promise<void> {
        try {
            await mod.unstarSheet(sheet.platform, String(sheet.id));
            store.set(starredSheetsAtom, await mod.getStarredSheets());
            this.starredIdSet.delete(compositeKey(sheet.platform, String(sheet.id)));
            this.events.emit('starredChange');
        } catch (e) {
            this.events.emit('error', e instanceof Error ? e : new Error(String(e)));
        }
    }

    async setStarredMusicSheets(orderedKeys: IMedia.IMediaBase[]): Promise<void> {
        await mod.setStarredOrder(orderedKeys);
        store.set(starredSheetsAtom, await mod.getStarredSheets());
    }

    // ─── 歌单详情（全量加载） ───

    async openSheet(sheetId: string): Promise<ILocalSheetDetail | null> {
        this.currentSheetId = sheetId;
        store.set(musicListAtom, []);
        store.set(isLoadingSheetAtom, true);

        const detail = await mod.getSheetDetail(sheetId);
        // 用户在等待期间切换了歌单 → 丢弃旧结果
        if (this.currentSheetId !== sheetId) return null;
        store.set(musicListAtom, detail?.musicList ?? []);
        store.set(isLoadingSheetAtom, false);
        return detail;
    }

    getCurrentMusicList(): IMusicItemSlim[] {
        return store.get(musicListAtom);
    }

    // ─── Favorite（同步 O(1)） ───

    isFavoriteMusic(item: { platform: string; id: string }): boolean {
        return this.favoriteIdSet.has(compositeKey(item.platform, item.id));
    }

    /** 通过 compositeKey 查询收藏状态（O(1)，供 useSyncExternalStore 使用） */
    isFavoriteByKey(key: string): boolean {
        return this.favoriteIdSet.has(key);
    }

    /** 订阅 favorite 变化（供 useSyncExternalStore 使用） */
    subscribeFavoriteChange = (cb: () => void): (() => void) => {
        this.events.on('favoriteChange', cb);
        return () => this.events.off('favoriteChange', cb);
    };

    // ─── Starred（同步 O(1)） ───

    isSheetStarred(item: { platform: string; id: string }): boolean {
        return this.starredIdSet.has(compositeKey(item.platform, String(item.id)));
    }

    /** 订阅 starred 变化（供 useSyncExternalStore 使用） */
    subscribeStarredChange = (cb: () => void): (() => void) => {
        this.events.on('starredChange', cb);
        return () => this.events.off('starredChange', cb);
    };

    // ─── 歌单内搜索（renderer 侧 filter） ───

    searchInCurrentSheet(keyword: string): IMusicItemSlim[] {
        const list = store.get(musicListAtom);
        if (!keyword) return list;
        const lower = keyword.toLowerCase();
        return list.filter(
            (m) => m.title.toLowerCase().includes(lower) || m.artist.toLowerCase().includes(lower),
        );
    }

    // ─── 内部方法 ───

    /**
     * 处理 main 侧内部变更：按需刷新 musicListAtom + favoriteIdSet（在主进程更新了某个歌单的内容）。
     * 仅在 sheetId 匹配当前打开歌单时拉取 musicList，避免无关歌单变更触发多余 IPC。
     */
    private async syncInternalChange(sheetId?: string) {
        const current = this.currentSheetId;
        if (current && (!sheetId || sheetId === current)) {
            const detail = await mod.getSheetDetail(current);
            // 异步竞态守卫：异步期间可能已切换歌单
            if (this.currentSheetId === current && detail) {
                store.set(musicListAtom, detail.musicList);
            }
        }
        // 若 internal 事件影响了 favorite 歌单，同步刷新本地缓存
        // TODO [P3]: 当 sheetId === FAVORITE 且等于 currentSheetId 时，上面 getSheetDetail
        //  已拉取过同一歌单，可复用 detail 构建 favoriteIdSet，省去 refreshFavoriteCache 的重复 IPC。
        if (!sheetId || sheetId === DEFAULT_FAVORITE_SHEET_ID) {
            await this.refreshFavoriteCache();
        }
    }

    private async refreshFavoriteCache() {
        const detail = await mod.getSheetDetail(DEFAULT_FAVORITE_SHEET_ID);
        if (!detail) return;

        const newSet = new Set<string>();
        let hasNewKey = false;

        for (const m of detail.musicList) {
            const key = compositeKey(m.platform, m.id);
            newSet.add(key);
            if (!hasNewKey && !this.favoriteIdSet.has(key)) {
                hasNewKey = true;
            }
        }

        const changed = hasNewKey || newSet.size !== this.favoriteIdSet.size;
        this.favoriteIdSet = newSet;
        if (changed) {
            this.events.emit('favoriteChange');
        }
    }
}

// ─── 模块单例 ───

const musicSheet = new MusicSheetRenderer();
export default musicSheet;

// ═══════════════════════════════════════════════════════
// React Hooks
// ═══════════════════════════════════════════════════════

/** 监听当前打开歌单的 musicList（乐观更新后的实时状态） */
export function useCurrentMusicList(): IMusicItemSlim[] {
    return useAtomValue(musicListAtom);
}

/** 某首歌曲是否收藏 — 同步 O(1) 判断，仅在该歌曲收藏状态实际变化时触发 re-render */
export function useMusicIsFavorite(musicItem: { platform: string; id: string }): boolean {
    const key = musicItem ? compositeKey(musicItem.platform, String(musicItem.id)) : null;

    const getSnapshot = useCallback(() => (key ? musicSheet.isFavoriteByKey(key) : false), [key]);

    return useSyncExternalStore(musicSheet.subscribeFavoriteChange, getSnapshot);
}

/** 监听歌单列表变更 */
export function useMusicSheetList(): ILocalSheetMeta[] {
    return useAtomValue(sheetsAtom);
}

/** 按 ID 获取单个歌单的元数据（响应式） */
export function useMusicSheetMeta(sheetId: string | undefined): ILocalSheetMeta | null {
    const sheets = useAtomValue(sheetsAtom);
    return useMemo(() => sheets.find((s) => s.id === sheetId) ?? null, [sheets, sheetId]);
}

/** 监听 sheet loading 状态 */
export function useIsLoadingSheet(): boolean {
    return useAtomValue(isLoadingSheetAtom);
}

/** 监听星标歌单列表 */
export function useStarredSheets(): IStarredSheetItem[] {
    return useAtomValue(starredSheetsAtom);
}

/** 某个远程歌单是否已收藏 — 同步 O(1)，仅在 starred 状态变化时 re-render */
export function useIsSheetStarred(item: { platform: string; id: string }): boolean {
    return useSyncExternalStore(musicSheet.subscribeStarredChange, () =>
        musicSheet.isSheetStarred(item),
    );
}
