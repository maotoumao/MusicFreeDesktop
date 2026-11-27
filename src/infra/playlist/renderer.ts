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

class PlaylistRenderer {
    static instance: PlaylistRenderer | null = null;

    public readonly events = new EventEmitter<IRendererEvents>();
    private favoriteIdSet = new Set<string>();
    private starredIdSet = new Set<string>();
    private currentPlaylistId: string | null = null;
    private mutationQueue = new MutationQueue();

    constructor() {
        this.mutationQueue.onError(async (e) => {
            await this.reloadState();
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
        if (this.currentPlaylistId) {
            const detail = await mod.getPlaylistDetail(this.currentPlaylistId);
            if (detail) store.set(musicListAtom, detail.musicList);
        }
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
        // 乐观更新
        if (this.currentPlaylistId === playlistId) {
            store.set(musicListAtom, []);
        }
        if (playlistId === DEFAULT_FAVORITE_PLAYLIST_ID) {
            this.favoriteIdSet.clear();
            this.events.emit('favoriteChange');
        }
        this.mutationQueue.enqueue(() => mod.clearPlaylist(playlistId));
    }

    // ─── 歌曲操作（乐观更新 + 队列写入） ───

    addMusicToPlaylist(
        musicItems: IMusic.IMusicItem | IMusicItemSlim | Array<IMusic.IMusicItem | IMusicItemSlim>,
        playlistId: string,
    ): void {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const slimItems = items.map(musicItemToSlim);

        // 乐观更新：本地数组
        if (this.currentPlaylistId === playlistId) {
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
        if (playlistId === DEFAULT_FAVORITE_PLAYLIST_ID) {
            for (const m of slimItems) {
                this.favoriteIdSet.add(compositeKey(m.platform, m.id));
            }
            this.events.emit('favoriteChange');
        }

        this.mutationQueue.enqueue(() => mod.addMusic(playlistId, items).then(() => {}));
    }

    addMusicToFavorite(
        musicItems: IMusic.IMusicItem | IMusicItemSlim | Array<IMusic.IMusicItem | IMusicItemSlim>,
    ): void {
        this.addMusicToPlaylist(musicItems, DEFAULT_FAVORITE_PLAYLIST_ID);
    }

    removeMusicFromPlaylist(
        musicItems: IMedia.IMediaBase | IMedia.IMediaBase[],
        playlistId: string,
    ): void {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const removeSet = new Set(items.map((it) => compositeKey(it.platform, it.id)));

        if (this.currentPlaylistId === playlistId) {
            store.set(musicListAtom, (prev) =>
                prev.filter((m) => !removeSet.has(compositeKey(m.platform, m.id))),
            );
        }

        if (playlistId === DEFAULT_FAVORITE_PLAYLIST_ID) {
            for (const it of items) {
                this.favoriteIdSet.delete(compositeKey(it.platform, it.id));
            }
            this.events.emit('favoriteChange');
        }

        const bases = items.map((it) => ({ platform: it.platform, id: it.id }));
        this.mutationQueue.enqueue(() => mod.removeMusic(playlistId, bases));
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
        const removeSet = new Set(items.map((it) => compositeKey(it.platform, it.id)));

        store.set(musicListAtom, (prev) =>
            prev.filter((m) => !removeSet.has(compositeKey(m.platform, m.id))),
        );

        for (const it of items) {
            this.favoriteIdSet.delete(compositeKey(it.platform, it.id));
        }
        this.events.emit('favoriteChange');

        const bases = items.map((it) => ({ platform: it.platform, id: it.id }));
        this.mutationQueue.enqueue(() => mod.removeFromAllPlaylists(bases));
    }

    updateMusicOrder(playlistId: string, orderedMusicList: IMusicItemSlim[]): void {
        if (this.currentPlaylistId === playlistId) {
            store.set(musicListAtom, [...orderedMusicList]);
        }
        const keys = orderedMusicList.map((m) => ({ platform: m.platform, id: m.id }));
        this.mutationQueue.enqueue(() => mod.updateMusicOrder(playlistId, keys));
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
        this.currentPlaylistId = playlistId;
        store.set(musicListAtom, []);
        store.set(isLoadingPlaylistAtom, true);

        const detail = await mod.getPlaylistDetail(playlistId);
        // 用户在等待期间切换了歌单 → 丢弃旧结果
        if (this.currentPlaylistId !== playlistId) return null;
        store.set(musicListAtom, detail?.musicList ?? []);
        store.set(isLoadingPlaylistAtom, false);
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
     * 处理 main 侧内部变更：按需刷新 musicListAtom + favoriteIdSet（在主进程更新了某个歌单的内容）。
     * 仅在 sheetId 匹配当前打开歌单时拉取 musicList，避免无关歌单变更触发多余 IPC。
     */
    private async syncInternalChange(playlistId?: string) {
        const current = this.currentPlaylistId;
        if (current && (!playlistId || playlistId === current)) {
            const detail = await mod.getPlaylistDetail(current);
            // 异步竞态守卫：异步期间可能已切换歌单
            if (this.currentPlaylistId === current && detail) {
                store.set(musicListAtom, detail.musicList);
            }
        }
        // 若 internal 事件影响了 favorite 歌单，同步刷新本地缓存
        // TODO [P3]: 当 sheetId === FAVORITE 且等于 currentPlaylistId 时，上面 getPlaylistDetail
        //  已拉取过同一歌单，可复用 detail 构建 favoriteIdSet，省去 refreshFavoriteCache 的重复 IPC。
        if (!playlistId || playlistId === DEFAULT_FAVORITE_PLAYLIST_ID) {
            await this.refreshFavoriteCache();
        }
    }

    private async refreshFavoriteCache() {
        const detail = await mod.getPlaylistDetail(DEFAULT_FAVORITE_PLAYLIST_ID);
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
