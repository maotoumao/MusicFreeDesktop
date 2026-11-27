/**
 * playlist — Renderer 层
 *
 * 职责：
 * - 管理歌单/歌曲的内存缓存，提供同步读取 API
 * - 乐观更新 + MutationQueue 串行异步持久化
 * - Favorite Set 本地缓存（同步 O(1) 判断）
 * - 提供 React Hooks（jotai atom）
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { atom, getDefaultStore, useAtomValue } from 'jotai';
import EventEmitter from 'eventemitter3';

import type {
    ILocalPlaylistMeta,
    ILocalPlaylistDetail,
    IMusicItemSlim,
    ICreatePlaylistParams,
    IUpdatePlaylistParams,
    IStarredPlaylistItem,
} from '@appTypes/infra/playlist';

import { compositeKey } from '@common/mediaKey';
import musicItemToSlim from '@common/musicItemToSlim';
import MutationQueue from '@common/mutationQueue';
import {
    CONTEXT_BRIDGE_KEY,
    DEFAULT_FAVORITE_PLAYLIST_ID,
    MAX_MUSIC_PER_PLAYLIST,
    type IPlaylistEvent,
} from './common/constant';

// ─── Preload Bridge ───

interface IMod {
    getAllPlaylists(): Promise<ILocalPlaylistMeta[]>;
    getPlaylistDetail(playlistId: string): Promise<ILocalPlaylistDetail | null>;
    createPlaylist(params: ICreatePlaylistParams): Promise<ILocalPlaylistMeta>;
    deletePlaylist(playlistId: string): Promise<void>;
    updatePlaylist(params: IUpdatePlaylistParams): Promise<void>;
    clearPlaylist(playlistId: string): Promise<void>;
    addMusic(
        playlistId: string,
        musicItems: IMusic.IMusicItem[],
    ): Promise<{ added: number; truncated: number }>;
    removeMusic(playlistId: string, musicBases: IMedia.IMediaBase[]): Promise<void>;
    removeFromAllPlaylists(musicBases: IMedia.IMediaBase[]): Promise<void>;
    updateMusicOrder(playlistId: string, orderedKeys: IMedia.IMediaBase[]): Promise<void>;
    getRawMusicItem(platform: string, id: string): Promise<IMusic.IMusicItem | null>;
    getRawMusicItems(keys: IMedia.IMediaBase[]): Promise<IMusic.IMusicItem[]>;
    getStarredPlaylists(): Promise<IStarredPlaylistItem[]>;
    starPlaylist(playlist: IMusic.IPlaylistItem): Promise<void>;
    unstarPlaylist(platform: string, id: string): Promise<void>;
    setStarredOrder(orderedKeys: IMedia.IMediaBase[]): Promise<void>;
    // ─── 播放队列 ───
    playQueueGetAll(): Promise<IMusicItemSlim[]>;
    playQueueSet(items: IMusic.IMusicItem[], fromPlaylistId?: string): Promise<void>;
    playQueueAdd(items: IMusic.IMusicItem[], afterIndex: number): Promise<void>;
    playQueueRemove(musicBases: IMedia.IMediaBase[]): Promise<void>;
    playQueueClear(): Promise<void>;
    // ─── 事件 ───
    onPlaylistEvent(cb: (event: IPlaylistEvent) => void): () => void;
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
const playlistsAtom = atom<ILocalPlaylistMeta[]>([]);

/** 星标远程歌单 */
const starredPlaylistsAtom = atom<IStarredPlaylistItem[]>([]);

/** 当前歌曲列表 */
const musicListAtom = atom<IMusicItemSlim[]>([]);

/** 正在加载歌单详情 */
const isLoadingPlaylistAtom = atom(false);

// ═══════════════════════════════════════════════════════
// PlaylistRenderer
// ═══════════════════════════════════════════════════════

interface IRendererEvents {
    error: (e: Error) => void;
    favoriteChange: () => void;
    starredChange: () => void;
}

/**
 * 一次歌曲写入在界面上的效果。界面状态 = 数据库快照 + 依次重放还没写完的操作；
 * 写完后并入快照，写入失败或被清出队列时丢弃。
 */
type IListOp =
    | { kind: 'add'; playlistId: string; items: IMusicItemSlim[]; deferred: boolean }
    /** playlistId 为 null 表示从所有歌单移除 */
    | { kind: 'remove'; playlistId: string | null; keys: Set<string> }
    | { kind: 'clear'; playlistId: string }
    | { kind: 'order'; playlistId: string; items: IMusicItemSlim[] };

const keyOf = (m: IMedia.IMediaBase) => compositeKey(m.platform, String(m.id));

function opTargets(op: IListOp, playlistId: string): boolean {
    return op.playlistId === null || op.playlistId === playlistId;
}

/** 与主进程写入语义一致：新歌插到最前（已有的保持原位、同一批只插一次）；重排后才加入的歌在最前 */
function applyToList(list: IMusicItemSlim[], op: IListOp): IMusicItemSlim[] {
    switch (op.kind) {
        case 'add': {
            if (op.deferred) return list;
            const seen = new Set(list.map(keyOf));
            const fresh: IMusicItemSlim[] = [];
            for (const m of op.items) {
                const k = keyOf(m);
                if (!seen.has(k)) {
                    seen.add(k);
                    fresh.push(m);
                }
            }
            return fresh.length > 0 ? [...fresh, ...list] : list;
        }
        case 'remove': {
            const next = list.filter((m) => !op.keys.has(keyOf(m)));
            return next.length === list.length ? list : next;
        }
        case 'clear':
            return list.length > 0 ? [] : list;
        case 'order': {
            const ordered = new Set(op.items.map(keyOf));
            const present = new Set(list.map(keyOf));
            return [
                ...list.filter((m) => !ordered.has(keyOf(m))),
                ...op.items.filter((m) => present.has(keyOf(m))),
            ];
        }
    }
}

/** 作用到收藏键集合，返回是否有变化 */
function applyToSet(set: Set<string>, op: IListOp): boolean {
    const before = set.size;
    switch (op.kind) {
        case 'add':
            if (!op.deferred) for (const m of op.items) set.add(keyOf(m));
            break;
        case 'remove':
            for (const k of op.keys) set.delete(k);
            break;
        case 'clear':
            set.clear();
            break;
        case 'order':
            return false;
    }
    return set.size !== before;
}

/** 快照之后已写完的操作攒到这个数量就并入快照 */
const SETTLED_COMPACT_LIMIT = 32;

type IReadOutcome =
    { detail: ILocalPlaylistDetail | null } | { error: unknown } | { skipped: true };

class PlaylistRenderer {
    static instance: PlaylistRenderer | null = null;

    public readonly events = new EventEmitter<IRendererEvents>();
    private favoriteIdSet = new Set<string>();
    private starredIdSet = new Set<string>();
    private currentPlaylistId: string | null = null;
    private mutationQueue = new MutationQueue();
    /** 已入队、还没写完的歌曲操作（按入队顺序） */
    private pendingOps: IListOp[] = [];
    /** 当前歌单的数据库快照，以及快照之后已写完、尚未并入快照的操作 */
    private listBase: { playlistId: string; items: IMusicItemSlim[]; settled: IListOp[] } | null =
        null;
    /** 「我喜欢」的数据库快照（键集合） */
    private favoriteBase = new Set<string>();
    /** 每次打开歌单递增；读取结果只在没有被更晚的打开取代时采用 */
    private openToken = 0;

    constructor() {
        this.mutationQueue.onError(async (e) => {
            await this.reloadState().catch(() => {});
            this.events.emit('error', e);
        });
    }

    // ─── 初始化 ───

    async setup() {
        if (PlaylistRenderer.instance) return;
        PlaylistRenderer.instance = this;

        const [playlists, starred] = await Promise.all([
            mod.getAllPlaylists(),
            mod.getStarredPlaylists(),
        ]);
        store.set(playlistsAtom, playlists);
        store.set(starredPlaylistsAtom, starred);

        this.starredIdSet = new Set(starred.map((s) => compositeKey(s.platform, s.id)));

        await this.refreshFavoriteCache();

        mod.onPlaylistEvent(async (event) => {
            try {
                // sheetsAtom 始终刷新（轻量 getAllPlaylists 查询，同步 worksNum 等元数据）
                store.set(playlistsAtom, await mod.getAllPlaylists());

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
        await this.refreshCurrentList();
        await this.refreshFavoriteCache();
    }

    // ─── 歌单列表 ───

    getAllPlaylists(): ILocalPlaylistMeta[] {
        return store.get(playlistsAtom);
    }

    // NOTE: IPC 完成后手动刷新 sheetsAtom，保证调用者 resolve 时数据已是最新。
    // main 侧广播会再触发一次 getAllPlaylists（双重拉取），但开销可忽略。

    async addPlaylist(title: string): Promise<ILocalPlaylistMeta> {
        const playlist = await mod.createPlaylist({ title });
        store.set(playlistsAtom, await mod.getAllPlaylists());
        return playlist;
    }

    // NOTE: 双重拉取，见 addSheet 注释
    async removePlaylist(playlistId: string): Promise<void> {
        await mod.deletePlaylist(playlistId);
        store.set(playlistsAtom, await mod.getAllPlaylists());
    }

    // NOTE: 双重拉取，见 addSheet 注释
    async updatePlaylist(playlistId: string, data: Partial<IUpdatePlaylistParams>): Promise<void> {
        await mod.updatePlaylist({ id: playlistId, ...data });
        store.set(playlistsAtom, await mod.getAllPlaylists());
    }

    clearPlaylist(playlistId: string): void {
        void this.commit({ kind: 'clear', playlistId }, () => mod.clearPlaylist(playlistId));
    }

    // ─── 歌曲操作（乐观更新 + 队列写入） ───

    /** 返回写入结果；超出歌单上限的末尾 truncated 首不会写入，写入失败时 reject */
    addMusicToPlaylist(
        musicItems: IMusic.IMusicItem | IMusicItemSlim | Array<IMusic.IMusicItem | IMusicItemSlim>,
        playlistId: string,
    ): Promise<{ added: number; truncated: number }> {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const slimItems = items.map(musicItemToSlim);
        // 缓存显示歌单已满时不做乐观更新，免得先插入整批再撤回；写完后按实际写入的部分更新
        const deferred =
            (store.get(playlistsAtom).find((p) => p.id === playlistId)?.worksNum ?? 0) >=
            MAX_MUSIC_PER_PLAYLIST;
        const op: IListOp = { kind: 'add', playlistId, items: slimItems, deferred };

        return this.commit(
            op,
            () => mod.addMusic(playlistId, items),
            ({ added, truncated }) => {
                if (truncated <= 0 && !deferred) return op;
                // 主进程按输入顺序写入前 length - truncated 首
                const accepted = slimItems.slice(0, slimItems.length - truncated);
                return {
                    op: { ...op, items: accepted, deferred: false },
                    changed: truncated > 0 ? !deferred || added > 0 : added > 0,
                };
            },
        );
    }

    addMusicToFavorite(
        musicItems: IMusic.IMusicItem | IMusicItemSlim | Array<IMusic.IMusicItem | IMusicItemSlim>,
    ): void {
        void this.addMusicToPlaylist(musicItems, DEFAULT_FAVORITE_PLAYLIST_ID);
    }

    removeMusicFromPlaylist(
        musicItems: IMedia.IMediaBase | IMedia.IMediaBase[],
        playlistId: string,
    ): void {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const bases = items.map((it) => ({ platform: it.platform, id: it.id }));
        void this.commit({ kind: 'remove', playlistId, keys: new Set(items.map(keyOf)) }, () =>
            mod.removeMusic(playlistId, bases),
        );
    }

    removeMusicFromFavorite(musicItems: IMedia.IMediaBase | IMedia.IMediaBase[]): void {
        this.removeMusicFromPlaylist(musicItems, DEFAULT_FAVORITE_PLAYLIST_ID);
    }

    /**
     * 从所有歌单中移除歌曲（排除播放队列，由 trackPlayer 自行管理）。
     * 乐观更新当前 musicListAtom + favoriteIdSet。
     */
    removeFromAllPlaylists(musicItems: IMedia.IMediaBase | IMedia.IMediaBase[]): void {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const bases = items.map((it) => ({ platform: it.platform, id: it.id }));
        void this.commit(
            { kind: 'remove', playlistId: null, keys: new Set(items.map(keyOf)) },
            () => mod.removeFromAllPlaylists(bases),
        );
    }

    updateMusicOrder(playlistId: string, orderedMusicList: IMusicItemSlim[]): void {
        const keys = orderedMusicList.map((m) => ({ platform: m.platform, id: m.id }));
        void this.commit({ kind: 'order', playlistId, items: [...orderedMusicList] }, () =>
            mod.updateMusicOrder(playlistId, keys),
        );
    }

    // ─── 原始数据读取 ───

    getRawMusicItem(platform: string, id: string): Promise<IMusic.IMusicItem | null> {
        return mod.getRawMusicItem(platform, id);
    }

    getRawMusicItems(keys: IMedia.IMediaBase[]): Promise<IMusic.IMusicItem[]> {
        return mod.getRawMusicItems(keys);
    }

    // ─── 星标远程歌单 ───
    // TODO [P2]: 乐观更新 — 先同步更新 starredIdSet + starredPlaylistsAtom，再异步写 DB，
    //            失败时回滚（与 favorite 路径一致）。当前实现等待两次 IPC 后才更新 UI。

    getAllStarredPlaylists(): IStarredPlaylistItem[] {
        return store.get(starredPlaylistsAtom);
    }

    async starPlaylist(playlist: IMusic.IPlaylistItem): Promise<void> {
        try {
            await mod.starPlaylist(playlist);
            store.set(starredPlaylistsAtom, await mod.getStarredPlaylists());
            this.starredIdSet.add(compositeKey(playlist.platform, String(playlist.id)));
            this.events.emit('starredChange');
        } catch (e) {
            this.events.emit('error', e instanceof Error ? e : new Error(String(e)));
        }
    }

    async unstarPlaylist(playlist: IMedia.IMediaBase): Promise<void> {
        try {
            await mod.unstarPlaylist(playlist.platform, String(playlist.id));
            store.set(starredPlaylistsAtom, await mod.getStarredPlaylists());
            this.starredIdSet.delete(compositeKey(playlist.platform, String(playlist.id)));
            this.events.emit('starredChange');
        } catch (e) {
            this.events.emit('error', e instanceof Error ? e : new Error(String(e)));
        }
    }

    async setStarredPlaylists(orderedKeys: IMedia.IMediaBase[]): Promise<void> {
        await mod.setStarredOrder(orderedKeys);
        store.set(starredPlaylistsAtom, await mod.getStarredPlaylists());
    }

    // ─── 歌单详情（全量加载） ───

    async openPlaylist(playlistId: string): Promise<ILocalPlaylistDetail | null> {
        const token = ++this.openToken;
        this.currentPlaylistId = playlistId;
        this.listBase = null;
        store.set(musicListAtom, this.replayPendingOnList(playlistId, []));
        store.set(isLoadingPlaylistAtom, true);

        const outcome = await this.readInQueue(playlistId, () => token === this.openToken);
        // 用户在等待期间切换了歌单 → 丢弃旧结果
        if (token !== this.openToken || 'skipped' in outcome) return null;
        if ('error' in outcome) throw outcome.error;
        this.applyListSnapshot(playlistId, outcome.detail?.musicList ?? []);
        store.set(isLoadingPlaylistAtom, false);
        return outcome.detail;
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

    isPlaylistStarred(item: { platform: string; id: string }): boolean {
        return this.starredIdSet.has(compositeKey(item.platform, String(item.id)));
    }

    /** 订阅 starred 变化（供 useSyncExternalStore 使用） */
    subscribeStarredChange = (cb: () => void): (() => void) => {
        this.events.on('starredChange', cb);
        return () => this.events.off('starredChange', cb);
    };

    // ─── 歌单内搜索（renderer 侧 filter） ───

    searchInCurrentPlaylist(keyword: string): IMusicItemSlim[] {
        const list = store.get(musicListAtom);
        if (!keyword) return list;
        const lower = keyword.toLowerCase();
        return list.filter(
            (m) => m.title.toLowerCase().includes(lower) || m.artist.toLowerCase().includes(lower),
        );
    }

    // ─── 内部方法 ───

    /**
     * 乐观执行一次歌曲操作并排队写入。settle 根据写入结果给出实际生效的操作
     * （如截断后只保留写入的部分），changed 表示与乐观执行的效果不同、需要重算界面。
     */
    private commit<T>(
        op: IListOp,
        write: () => Promise<T>,
        settle: (result: T) => IListOp | { op: IListOp; changed: boolean } = () => op,
    ): Promise<T> {
        this.pendingOps.push(op);
        if (this.currentPlaylistId && opTargets(op, this.currentPlaylistId)) {
            store.set(musicListAtom, applyToList(store.get(musicListAtom), op));
        }
        if (opTargets(op, DEFAULT_FAVORITE_PLAYLIST_ID) && applyToSet(this.favoriteIdSet, op)) {
            this.events.emit('favoriteChange');
        }

        const result = this.mutationQueue.enqueue(write);
        result.then(
            (value) => {
                const settled = settle(value);
                const final = 'kind' in settled ? settled : settled.op;
                const changed = 'kind' in settled ? false : settled.changed;
                this.removePending(op);
                if (this.listBase && opTargets(final, this.listBase.playlistId)) {
                    this.listBase.settled.push(final);
                    if (this.listBase.settled.length >= SETTLED_COMPACT_LIMIT)
                        this.compactListBase();
                }
                if (opTargets(final, DEFAULT_FAVORITE_PLAYLIST_ID)) {
                    applyToSet(this.favoriteBase, final);
                }
                if (changed) this.recompute(final);
            },
            () => {
                // 写入失败或被清出队列：界面去掉这次操作的效果
                this.removePending(op);
                this.recompute(op);
            },
        );
        return result;
    }

    private removePending(op: IListOp) {
        const index = this.pendingOps.indexOf(op);
        if (index !== -1) this.pendingOps.splice(index, 1);
    }

    private compactListBase(): IMusicItemSlim[] {
        const base = this.listBase!;
        for (const op of base.settled) base.items = applyToList(base.items, op);
        base.settled = [];
        return base.items;
    }

    private replayPendingOnList(playlistId: string, list: IMusicItemSlim[]): IMusicItemSlim[] {
        let out = list;
        for (const op of this.pendingOps) {
            if (opTargets(op, playlistId)) out = applyToList(out, op);
        }
        return out;
    }

    /** 按快照与还没写完的操作重算受 op 影响的界面状态 */
    private recompute(op: IListOp) {
        const current = this.currentPlaylistId;
        if (current && opTargets(op, current)) {
            const base = this.listBase?.playlistId === current ? this.compactListBase() : [];
            store.set(musicListAtom, this.replayPendingOnList(current, base));
        }
        if (opTargets(op, DEFAULT_FAVORITE_PLAYLIST_ID)) this.recomputeFavorites();
    }

    private recomputeFavorites() {
        const next = new Set(this.favoriteBase);
        for (const op of this.pendingOps) {
            if (opTargets(op, DEFAULT_FAVORITE_PLAYLIST_ID)) applyToSet(next, op);
        }
        const changed =
            next.size !== this.favoriteIdSet.size ||
            [...next].some((k) => !this.favoriteIdSet.has(k));
        this.favoriteIdSet = next;
        if (changed) this.events.emit('favoriteChange');
    }

    /** 读到的列表成为新的快照，再重放读取之后入队、还没写完的操作 */
    private applyListSnapshot(playlistId: string, loaded: IMusicItemSlim[]) {
        this.listBase = { playlistId, items: loaded, settled: [] };
        store.set(musicListAtom, this.replayPendingOnList(playlistId, loaded));
    }

    /**
     * 排在已入队的写入之后读取歌单，读到的列表已包含这些写入；轮到时已不需要（wanted 为 false）就跳过。
     * 读取失败不影响队列里的其他写入；前面的写入失败、读取被清出队列时直接读取。
     */
    private readInQueue(playlistId: string, wanted: () => boolean): Promise<IReadOutcome> {
        return this.mutationQueue
            .enqueue<IReadOutcome>(async () => {
                if (!wanted()) return { skipped: true };
                try {
                    return { detail: await mod.getPlaylistDetail(playlistId) };
                } catch (error) {
                    return { error };
                }
            })
            .catch(async () => {
                try {
                    return { detail: await mod.getPlaylistDetail(playlistId) };
                } catch (error) {
                    return { error };
                }
            });
    }

    /** 重新读取当前歌单（主进程内部改动、写入失败后的恢复） */
    private async refreshCurrentList() {
        const current = this.currentPlaylistId;
        if (!current) return;
        const token = this.openToken;
        const outcome = await this.readInQueue(current, () => token === this.openToken);
        if (token !== this.openToken || 'skipped' in outcome) return;
        if ('error' in outcome) throw outcome.error;
        if (outcome.detail) this.applyListSnapshot(current, outcome.detail.musicList);
    }

    /**
     * 处理 main 侧内部变更：按需刷新 musicListAtom + favoriteIdSet（在主进程更新了某个歌单的内容）。
     * 仅在 sheetId 匹配当前打开歌单时拉取 musicList，避免无关歌单变更触发多余 IPC。
     */
    private async syncInternalChange(playlistId?: string) {
        const current = this.currentPlaylistId;
        if (current && (!playlistId || playlistId === current)) {
            await this.refreshCurrentList();
        }
        // 若 internal 事件影响了 favorite 歌单，同步刷新本地缓存
        // TODO [P3]: 当 sheetId === FAVORITE 且等于 currentPlaylistId 时，上面已拉取过同一歌单，
        //  可复用结果构建 favoriteIdSet，省去 refreshFavoriteCache 的重复 IPC。
        if (!playlistId || playlistId === DEFAULT_FAVORITE_PLAYLIST_ID) {
            await this.refreshFavoriteCache();
        }
    }

    private async refreshFavoriteCache() {
        const outcome = await this.readInQueue(DEFAULT_FAVORITE_PLAYLIST_ID, () => true);
        if ('error' in outcome) throw outcome.error;
        if (!('detail' in outcome) || !outcome.detail) return;
        this.favoriteBase = new Set(outcome.detail.musicList.map(keyOf));
        this.recomputeFavorites();
    }
}

// ─── 模块单例 ───

const playlistManager = new PlaylistRenderer();
export default playlistManager;

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

    const getSnapshot = useCallback(
        () => (key ? playlistManager.isFavoriteByKey(key) : false),
        [key],
    );

    return useSyncExternalStore(playlistManager.subscribeFavoriteChange, getSnapshot);
}

/** 监听歌单列表变更 */
export function usePlaylistList(): ILocalPlaylistMeta[] {
    return useAtomValue(playlistsAtom);
}

/** 按 ID 获取单个歌单的元数据（响应式） */
export function usePlaylistMeta(playlistId: string | undefined): ILocalPlaylistMeta | null {
    const playlists = useAtomValue(playlistsAtom);
    return useMemo(
        () => playlists.find((s) => s.id === playlistId) ?? null,
        [playlists, playlistId],
    );
}

/** 监听 sheet loading 状态 */
export function useIsLoadingPlaylist(): boolean {
    return useAtomValue(isLoadingPlaylistAtom);
}

/** 监听星标歌单列表 */
export function useStarredPlaylists(): IStarredPlaylistItem[] {
    return useAtomValue(starredPlaylistsAtom);
}

/** 某个远程歌单是否已收藏 — 同步 O(1)，仅在 starred 状态变化时 re-render */
export function useIsPlaylistStarred(item: { platform: string; id: string }): boolean {
    return useSyncExternalStore(playlistManager.subscribeStarredChange, () =>
        playlistManager.isPlaylistStarred(item),
    );
}
