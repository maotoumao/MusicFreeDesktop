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
    IAddMusicResult,
    IAddMusicOptions,
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
        options?: IAddMusicOptions,
    ): Promise<IAddMusicResult>;
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
    | {
          kind: 'add';
          playlistId: string;
          items: IMusicItemSlim[];
          deferred: boolean;
          /** 延迟添加写完后实际写入的歌曲 */
          accepted?: IMusicItemSlim[];
      }
    /** playlistId 为 null 表示从所有歌单移除 */
    | { kind: 'remove'; playlistId: string | null; keys: Set<string> }
    | { kind: 'clear'; playlistId: string }
    | {
          kind: 'order';
          playlistId: string;
          items: IMusicItemSlim[];
          /** 发起时是当前界面列表的完整重新排列，可直接作为新列表 */
          direct: boolean;
          /** 发起时还没显示的延迟添加：写完后若收下了不在这次重排里的歌，需要重读实际顺序 */
          hiddenAdds: IListOp[];
      };

const keyOf = (m: IMedia.IMediaBase) => compositeKey(m.platform, String(m.id));

function opTargets(op: IListOp, playlistId: string): boolean {
    return op.playlistId === null || op.playlistId === playlistId;
}

/** 与主进程写入语义一致：新歌插到最前（已有的保持原位并更新资料、同一批只插一次）；重排后才加入的歌在最前 */
function applyToList(list: IMusicItemSlim[], op: IListOp): IMusicItemSlim[] {
    switch (op.kind) {
        case 'add': {
            if (op.deferred) return list;
            // 同一首歌按主进程逐条 upsert 的规则合并资料（封面取最后一个非空值），位置取第一次出现
            const incoming = new Map<string, IMusicItemSlim>();
            for (const m of op.items) {
                const k = keyOf(m);
                const prev = incoming.get(k);
                incoming.set(k, prev ? mergeDisplayFields(prev, m) : m);
            }
            const seen = new Set(list.map(keyOf));
            const fresh: IMusicItemSlim[] = [];
            let overlaps = false;
            for (const m of op.items) {
                const k = keyOf(m);
                if (seen.has(k)) {
                    overlaps = true;
                    continue;
                }
                seen.add(k);
                fresh.push(incoming.get(k)!);
            }
            // 已在歌单里的歌保持原位，展示资料按主进程 upsert 更新
            let base = list;
            if (overlaps) {
                let changed = false;
                const merged = list.map((m) => {
                    const next = incoming.get(keyOf(m));
                    const out = next ? mergeDisplayFields(m, next) : m;
                    if (out !== m) changed = true;
                    return out;
                });
                if (changed) base = merged;
            }
            return fresh.length > 0 ? [...fresh, ...base] : base;
        }
        case 'remove': {
            const next = list.filter((m) => !op.keys.has(keyOf(m)));
            return next.length === list.length ? list : next;
        }
        case 'clear':
            return list.length > 0 ? [] : list;
        case 'order': {
            // 重排只决定顺序，歌曲资料取当前列表里的（可能已按后续写入更新）
            const byKey = new Map(list.map((m) => [keyOf(m), m]));
            const ordered = new Set(op.items.map(keyOf));
            const reordered: IMusicItemSlim[] = [];
            for (const m of op.items) {
                const current = byKey.get(keyOf(m));
                if (current) reordered.push(current);
            }
            return [...list.filter((m) => !ordered.has(keyOf(m))), ...reordered];
        }
    }
}

/** 依次作用多个操作；连续的删除合并成一次过滤，避免大歌单上逐个扫描 */
function applyOps(list: IMusicItemSlim[], ops: IListOp[]): IMusicItemSlim[] {
    let out = list;
    // 只有一个删除时直接用它的键集合，遇到第二个连续删除才合并
    let removing: Set<string> | null = null;
    let merged = false;
    const flush = () => {
        if (removing) out = applyToList(out, { kind: 'remove', playlistId: null, keys: removing });
        removing = null;
        merged = false;
    };
    for (const op of ops) {
        if (op.kind === 'remove') {
            if (!removing) {
                removing = op.keys;
            } else {
                if (!merged) {
                    removing = new Set(removing);
                    merged = true;
                }
                for (const k of op.keys) removing.add(k);
            }
            continue;
        }
        flush();
        out = applyToList(out, op);
    }
    flush();
    return out;
}

/** 与主进程 upsertMusicItem 一致：标题、歌手、专辑、时长覆盖，封面为空时保留原值 */
function mergeDisplayFields(current: IMusicItemSlim, next: IMusicItemSlim): IMusicItemSlim {
    const artwork = next.artwork ?? current.artwork;
    if (
        current.title === next.title &&
        current.artist === next.artist &&
        current.album === next.album &&
        current.duration === next.duration &&
        current.artwork === artwork
    ) {
        return current;
    }
    return {
        ...current,
        title: next.title,
        artist: next.artist,
        album: next.album,
        duration: next.duration,
        artwork,
    };
}

/** items 是 list 里这些对象的完整重新排列（拖拽排序的情况） */
function isPermutationOf(items: IMusicItemSlim[], list: IMusicItemSlim[]): boolean {
    if (items.length !== list.length) return false;
    const present = new Set(list);
    return items.every((m) => present.has(m));
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

/** 快照之后已写完、但因还有写入排队而没能直接采用界面列表的操作，攒到这个数量开始在空闲时逐个并入 */
const COMPACT_BACKLOG = 32;

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
    private compactTimer: ReturnType<typeof setTimeout> | null = null;
    /** 写入失败后等待合并重算的操作 */
    private droppedOps: IListOp[] = [];
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
    ): Promise<IAddMusicResult> {
        const items = Array.isArray(musicItems) ? musicItems : [musicItems];
        const slimItems = items.map(musicItemToSlim);
        // 缓存显示歌单已满时不做乐观更新，免得先插入整批再撤回；写完后按实际写入的部分更新
        const deferred =
            (store.get(playlistsAtom).find((p) => p.id === playlistId)?.worksNum ?? 0) >=
            MAX_MUSIC_PER_PLAYLIST;
        const op: IListOp = { kind: 'add', playlistId, items: slimItems, deferred };

        return this.commit(
            op,
            // 写入真正发出时目标歌单正显示在界面上，才需要库里保留的封面来纠正显示
            () =>
                mod.addMusic(playlistId, items, {
                    reportArtworks: this.currentPlaylistId === playlistId,
                }),
            ({ added, truncated, keptArtworks }) => {
                if (truncated <= 0 && !deferred && !keptArtworks) return op;
                // 主进程按输入顺序写入前 length - truncated 首
                let accepted = slimItems.slice(0, slimItems.length - truncated);
                if (deferred) op.accepted = added > 0 ? accepted : [];
                let changed = deferred ? added > 0 : truncated > 0;
                // 传入时没有封面、库里保留了封面的歌，按库里的封面显示；当前显示的已是这个封面就不用重算
                if (keptArtworks) {
                    const kept = new Map(keptArtworks.map((a) => [keyOf(a), a.artwork]));
                    accepted = accepted.map((m) =>
                        !m.artwork && kept.has(keyOf(m))
                            ? { ...m, artwork: kept.get(keyOf(m))! }
                            : m,
                    );
                    if (!changed && !deferred) changed = this.shownArtworkDiffers(playlistId, kept);
                }
                return { op: { ...op, items: accepted, deferred: false }, changed };
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
        const items = [...orderedMusicList];
        const direct =
            this.hasCurrentSnapshot() &&
            this.currentPlaylistId === playlistId &&
            isPermutationOf(items, store.get(musicListAtom));
        const hiddenAdds = this.pendingOps.filter(
            (p) => p.kind === 'add' && p.deferred && opTargets(p, playlistId),
        );
        void this.commit({ kind: 'order', playlistId, items, direct, hiddenAdds }, () =>
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
        // 读到快照之前保持空列表，期间的操作在快照到达后重放（避免把部分歌曲当作完整列表）
        this.listBase = null;
        store.set(musicListAtom, []);
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
        if (this.hasCurrentSnapshot() && opTargets(op, this.currentPlaylistId!)) {
            const list = store.get(musicListAtom);
            store.set(
                musicListAtom,
                op.kind === 'order' && op.direct ? op.items : applyToList(list, op),
            );
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
                const base = this.listBase;
                // 一首都没写入的添加没有效果，不用并入快照
                const noEffect = final.kind === 'add' && final.items.length === 0;
                if (base && opTargets(final, base.playlistId)) {
                    if (
                        !changed &&
                        this.hasCurrentSnapshot() &&
                        !this.pendingOps.some((p) => opTargets(p, base.playlistId))
                    ) {
                        // 没有还没写完的操作时，界面就是「快照 + 已写完的操作」，直接作为新快照
                        base.items = store.get(musicListAtom);
                        base.settled = [];
                    } else if (!noEffect) {
                        base.settled.push(final);
                        if (base.settled.length >= COMPACT_BACKLOG) this.scheduleCompaction();
                    }
                }
                if (opTargets(final, DEFAULT_FAVORITE_PLAYLIST_ID)) {
                    applyToSet(this.favoriteBase, final);
                }
                if (changed) this.recompute(final);
                if (final.kind === 'order') this.refreshIfPartialOrder(final);
            },
            () => {
                // 写入失败或被清出队列：界面去掉这次操作的效果（同一轮清出的操作合并成一次重算）
                this.removePending(op);
                this.scheduleRecompute(op);
            },
        );
        return result;
    }

    /**
     * 主进程重排只给传入的歌依次设序号，其余歌保留原序号、可能落在中间：
     * 发起时不是当前界面列表的完整重新排列，或之前的延迟添加收下了不在这次重排里的歌时，写完后按队列顺序重新读取实际顺序。
     */
    private refreshIfPartialOrder(op: Extract<IListOp, { kind: 'order' }>) {
        if (!this.hasCurrentSnapshot() || this.currentPlaylistId !== op.playlistId) return;
        if (op.direct) {
            const accepted = op.hiddenAdds.flatMap((a) => (a.kind === 'add' && a.accepted) || []);
            if (accepted.length === 0) return;
            const ordered = new Set(op.items.map(keyOf));
            if (accepted.every((m) => ordered.has(keyOf(m)))) return;
        }
        this.refreshCurrentList().catch((e) =>
            this.events.emit('error', e instanceof Error ? e : new Error(String(e))),
        );
    }

    /** 当前显示的歌单里，是否有歌曲的封面与库里保留的不同 */
    private shownArtworkDiffers(playlistId: string, kept: Map<string, string>): boolean {
        if (this.currentPlaylistId !== playlistId || !this.hasCurrentSnapshot()) return false;
        // 还没写完的添加已经给了封面的歌，当前显示的是那次添加的封面，不用为这次结果重算
        const overridden = new Set<string>();
        for (const op of this.pendingOps) {
            if (op.kind !== 'add' || !opTargets(op, playlistId)) continue;
            for (const m of op.items) if (m.artwork && kept.has(keyOf(m))) overridden.add(keyOf(m));
        }
        return store.get(musicListAtom).some((m) => {
            const artwork = kept.get(keyOf(m));
            return artwork !== undefined && m.artwork !== artwork && !overridden.has(keyOf(m));
        });
    }

    /** 当前歌单已读到快照（没有在首次加载中） */
    private hasCurrentSnapshot(): boolean {
        return !!this.currentPlaylistId && this.listBase?.playlistId === this.currentPlaylistId;
    }

    private removePending(op: IListOp) {
        const index = this.pendingOps.indexOf(op);
        if (index !== -1) this.pendingOps.splice(index, 1);
    }

    /**
     * 写入积压到 COMPACT_BACKLOG 个时，已写完的操作在之后的空闲时逐个并入快照，每次只处理一个，
     * 避免集中占用界面线程；积压较少时等写完后直接采用界面列表。
     */
    private scheduleCompaction() {
        if (this.compactTimer) return;
        this.compactTimer = setTimeout(() => {
            this.compactTimer = null;
            const base = this.listBase;
            if (!base || base.settled.length === 0) return;
            base.items = applyToList(base.items, base.settled.shift()!);
            if (base.settled.length > 0) this.scheduleCompaction();
        }, 0);
    }

    private compactListBase(): IMusicItemSlim[] {
        const base = this.listBase!;
        base.items = applyOps(base.items, base.settled);
        base.settled = [];
        return base.items;
    }

    private replayPendingOnList(playlistId: string, list: IMusicItemSlim[]): IMusicItemSlim[] {
        return applyOps(
            list,
            this.pendingOps.filter((op) => opTargets(op, playlistId)),
        );
    }

    /** 按快照与还没写完的操作重算受 op 影响的界面状态 */
    private scheduleRecompute(op: IListOp) {
        const first = this.droppedOps.length === 0;
        this.droppedOps.push(op);
        if (!first) return;
        queueMicrotask(() => {
            const dropped = this.droppedOps;
            this.droppedOps = [];
            const current = this.currentPlaylistId;
            if (current && dropped.some((d) => opTargets(d, current))) this.recomputeList();
            if (dropped.some((d) => opTargets(d, DEFAULT_FAVORITE_PLAYLIST_ID))) {
                this.recomputeFavorites();
            }
        });
    }

    private recompute(op: IListOp) {
        const current = this.currentPlaylistId;
        if (current && opTargets(op, current)) this.recomputeList();
        if (opTargets(op, DEFAULT_FAVORITE_PLAYLIST_ID)) this.recomputeFavorites();
    }

    private recomputeList() {
        const current = this.currentPlaylistId;
        if (!current || !this.hasCurrentSnapshot()) return;
        store.set(musicListAtom, this.replayPendingOnList(current, this.compactListBase()));
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
            .catch(async (): Promise<IReadOutcome> => {
                if (!wanted()) return { skipped: true };
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
