/**
 * musicSheet — 主进程层
 *
 * 职责：
 * - 歌单 CRUD、歌曲增删排序、星标远程歌单
 * - 播放队列持久化
 * - 导出歌单详情
 * - IPC 注册 + 事件广播
 */
import { ipcMain } from 'electron';
import { nanoid } from 'nanoid';
import i18n from '@infra/i18n/main';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IDatabaseProvider } from '@appTypes/infra/database';
import type {
    ICreatePlaylistParams,
    IUpdatePlaylistParams,
    ILocalPlaylistMeta,
    ILocalPlaylistDetail,
    IMusicItemSlim,
} from '@appTypes/infra/playlist';
import {
    IPC,
    MAX_MUSIC_PER_PLAYLIST,
    MAX_QUEUE_SIZE,
    DEFAULT_FAVORITE_PLAYLIST_ID,
    PLAY_QUEUE_PLAYLIST_ID,
    DOWNLOADED_PLAYLIST_ID,
    type IPlaylistEvent,
} from '../common/constant';
import { createQueries, type IPlaylistQueries } from './queries';
import { INTERNAL_SLIM_KEY } from '@common/constant';
import { safeStringify, safeParse } from '@common/safeSerialize';
import type { IBackupProvider, IBackupPlaylist, RestoreMode } from '@appTypes/infra/backup';

class PlaylistManager {
    private isSetup = false;
    private db!: IDatabaseProvider;
    private queries!: IPlaylistQueries;
    private windowManager!: IWindowManager;
    private orphanCleanupTimer: ReturnType<typeof setTimeout> | null = null;

    public setup(deps: { db: IDatabaseProvider; windowManager: IWindowManager }) {
        if (this.isSetup) return;

        this.db = deps.db;
        const db = deps.db.getDatabase();
        this.queries = createQueries(db);
        this.windowManager = deps.windowManager;

        this.ensureDefaultPlaylist();
        this.ensurePlayQueuePlaylist();
        this.ensureDownloadedPlaylist();

        this.registerIpcHandlers();

        this.isSetup = true;
    }

    /** 清理资源 */
    public dispose() {
        if (this.orphanCleanupTimer) {
            clearTimeout(this.orphanCleanupTimer);
            this.queries.cleanOrphanMusic.run();
            this.orphanCleanupTimer = null;
        }
    }

    // ─── 主进程内部公开方法（供 downloadManager 等模块通过 DI 调用） ───

    /**
     * 将歌曲添加到指定歌单（upsert music_items + 插入 relation）。
     * 主进程内部调用，不通过 IPC。
     */
    public addMusicToPlaylist(
        musicItem: IMusic.IMusicItem | IMusicItemSlim,
        playlistId: string,
    ): void {
        const db = this.db.getDatabase();
        db.transaction(() => {
            const minOrder = (this.queries.getMinSortOrder.get(playlistId) as any).minOrder;
            const sid = String(musicItem.id);
            const now = Date.now();

            this.queries.upsertMusicItem.run({
                platform: musicItem.platform,
                id: sid,
                title: musicItem.title,
                artist: musicItem.artist ?? '',
                album: musicItem.album ?? '',
                duration: musicItem.duration ?? null,
                artwork: musicItem.artwork ?? null,
                raw: (musicItem as any)[INTERNAL_SLIM_KEY] ? null : safeStringify(musicItem),
            });
            this.queries.insertRelation.run({
                sheetId: playlistId,
                platform: musicItem.platform,
                musicId: sid,
                sortOrder: minOrder - 1,
                addedAt: now,
            });
        })();
        this.broadcastPlaylistEvent({ origin: 'internal', sheetId: playlistId });
    }

    /**
     * 从指定歌单移除歌曲。
     * 主进程内部调用，不通过 IPC。
     */
    public removeMusicFromPlaylist(platform: string, musicId: string, playlistId: string): void {
        this.queries.removeRelation.run({
            sheetId: playlistId,
            platform,
            musicId: String(musicId),
        });
        this.scheduleOrphanCleanup();
        this.broadcastPlaylistEvent({ origin: 'internal', sheetId: playlistId });
    }

    /**
     * 返回 downloadManager 所需的 DI 适配器。
     * 封装了对 __downloaded__ 歌单的 addMusicToPlaylist / removeMusicFromPlaylist 调用。
     */
    public getDownloadedPlaylistProvider() {
        return {
            addMusicToDownloaded: (musicItem: IMusic.IMusicItem) => {
                this.addMusicToPlaylist(musicItem, DOWNLOADED_PLAYLIST_ID);
            },
            removeFromDownloaded: (platform: string, musicId: string) => {
                this.removeMusicFromPlaylist(platform, musicId, DOWNLOADED_PLAYLIST_ID);
            },
        };
    }

    /**
     * 返回 downloadManager 所需的歌曲完整数据查询适配器。
     * 用于将 slim 对象解析为完整 raw JSON。
     */
    public getMusicItemProvider() {
        return {
            getRawMusicItem: (platform: string, id: string): IMusic.IMusicItem | null => {
                const row = this.queries.getMusicItemRaw.get(platform, id) as
                    { raw: string | null } | undefined;
                return row?.raw ? safeParse<IMusic.IMusicItem>(row.raw) : null;
            },
        };
    }

    /**
     * 返回 backup 模块所需的 DI 适配器。
     * 封装了歌单导出和导入操作，主进程内直接调用，不经 IPC。
     */
    public getBackupProvider(): IBackupProvider {
        return {
            /** 获取所有可导出歌单的元数据（排除 system 类型） */
            getExportablePlaylists: (): Array<{ id: string; title: string }> => {
                return (this.queries.getAllPlaylists.all() as ILocalPlaylistMeta[]).filter(
                    (s) => s.type !== 'system',
                );
            },

            /** 获取指定歌单内全量数据；没有完整数据的 slim 条目用展示字段导出，不丢歌 */
            getPlaylistMusicRaw: (playlistId: string): IMusic.IMusicItem[] => {
                const rows = this.queries.getPlaylistMusicRaw.all(playlistId) as Array<
                    IMusicItemSlim & { raw: string | null }
                >;
                return rows.map(({ raw, ...slim }) => {
                    const full = raw ? safeParse<IMusic.IMusicItem>(raw) : null;
                    return full ?? slimToMusicItem(slim);
                });
            },

            /**
             * 导入歌单数据。整个操作在单一 SQLite 事务中完成。
             * @param playlists - 待导入的歌单数组
             * @param mode - 'append' | 'overwrite'
             * @param onProgress - 进度回调（按歌单粒度）
             */
            importPlaylists: (
                playlists: IBackupPlaylist[],
                mode: RestoreMode,
                onProgress?: (current: number, total: number, playlistTitle: string) => void,
            ): { sheetsCount: number; songsCount: number } => {
                const db = this.db.getDatabase();
                let totalSongs = 0;

                // overwrite 清理在单独事务中执行
                if (mode === 'overwrite') {
                    db.transaction(() => {
                        const userPlaylists = (
                            this.queries.getAllPlaylists.all() as ILocalPlaylistMeta[]
                        ).filter(
                            (s) => s.type !== 'system' && s.id !== DEFAULT_FAVORITE_PLAYLIST_ID,
                        );
                        for (const playlist of userPlaylists) {
                            this.queries.clearPlaylistRelations.run(playlist.id);
                            this.queries.deletePlaylist.run(playlist.id);
                        }
                        this.queries.clearPlaylistRelations.run(DEFAULT_FAVORITE_PLAYLIST_ID);
                    })();
                }

                // 按歌单粒度拆分事务，让进度事件能实时到达 renderer
                for (let i = 0; i < playlists.length; i++) {
                    const playlist = playlists[i];
                    onProgress?.(i + 1, playlists.length, playlist.title);

                    db.transaction(() => {
                        let targetPlaylistId: string;

                        if (playlist.id === DEFAULT_FAVORITE_PLAYLIST_ID) {
                            targetPlaylistId = DEFAULT_FAVORITE_PLAYLIST_ID;
                        } else {
                            targetPlaylistId = nanoid();
                            this.queries.insertPlaylist.run({
                                id: targetPlaylistId,
                                title: playlist.title,
                                artwork: null,
                                description: null,
                                type: 'user',
                                folderPath: null,
                                sortOrder: 0,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            });
                        }

                        let maxOrder = (this.queries.getMaxSortOrder.get(targetPlaylistId) as any)
                            .maxOrder;
                        const now = Date.now();
                        for (const item of playlist.musicList) {
                            const sid = String(item.id);
                            const merged = mergeRestoredItem(
                                { ...item, id: sid },
                                this.queries.getMusicItemForRestore.get(item.platform, sid) as
                                    IRestoreBaseRow | undefined,
                            );
                            this.queries.upsertMusicItem.run({
                                platform: item.platform,
                                id: sid,
                                title: merged.title,
                                artist: merged.artist,
                                album: merged.album,
                                duration: merged.duration ?? null,
                                artwork: merged.artwork ?? null,
                                raw: safeStringify(merged),
                            });
                            this.queries.insertRelation.run({
                                sheetId: targetPlaylistId,
                                platform: item.platform,
                                musicId: sid,
                                sortOrder: ++maxOrder,
                                addedAt: now,
                            });
                        }
                        totalSongs += playlist.musicList.length;
                    })();
                }

                this.scheduleOrphanCleanup();
                this.broadcastPlaylistEvent({ origin: 'internal' });

                return { sheetsCount: playlists.length, songsCount: totalSongs };
            },
        };
    }

    private registerIpcHandlers() {
        // ─── 歌单 CRUD ────────────────────────

        ipcMain.handle(IPC.GET_ALL_PLAYLISTS, (): ILocalPlaylistMeta[] => {
            return (this.queries.getAllPlaylists.all() as ILocalPlaylistMeta[]).filter(
                (s) => s.type !== 'system',
            );
        });

        ipcMain.handle(
            IPC.GET_PLAYLIST_DETAIL,
            (_evt, playlistId: string): ILocalPlaylistDetail | null => {
                const playlist = this.queries.getPlaylistById.get(playlistId) as
                    ILocalPlaylistMeta | undefined;
                if (!playlist) return null;
                const musicList = this.queries.getPlaylistMusicSlim.all(playlistId);
                return { ...playlist, musicList } as ILocalPlaylistDetail;
            },
        );

        ipcMain.handle(
            IPC.CREATE_PLAYLIST,
            (_evt, params: ICreatePlaylistParams): ILocalPlaylistMeta => {
                const now = Date.now();
                const playlist = {
                    id: nanoid(),
                    title: params.title,
                    artwork: params.artwork ?? null,
                    description: params.description ?? null,
                    type: params.type ?? 'user',
                    folderPath: params.folderPath ?? null,
                    sortOrder: 0,
                    createdAt: now,
                    updatedAt: now,
                };
                this.queries.insertPlaylist.run(playlist);
                this.broadcastPlaylistEvent({ origin: 'user' });
                return { ...playlist, worksNum: 0, latestArtwork: null } as ILocalPlaylistMeta;
            },
        );

        ipcMain.handle(IPC.DELETE_PLAYLIST, (_evt, playlistId: string) => {
            if (playlistId === DEFAULT_FAVORITE_PLAYLIST_ID) {
                throw new Error(i18n.t('playlist.cannot_delete_favorite'));
            }
            if (playlistId === PLAY_QUEUE_PLAYLIST_ID) {
                throw new Error(i18n.t('playlist.cannot_delete_system'));
            }
            this.queries.clearPlaylistRelations.run(playlistId);
            this.queries.deletePlaylist.run(playlistId);
            this.scheduleOrphanCleanup();
            this.broadcastPlaylistEvent({ origin: 'user' });
        });

        ipcMain.handle(IPC.UPDATE_PLAYLIST, (_evt, params: IUpdatePlaylistParams) => {
            const existing = this.queries.getPlaylistById.get(params.id) as
                Record<string, unknown> | undefined;
            if (!existing) return;

            this.queries.updatePlaylist.run({
                id: params.id,
                title: params.title ?? existing.title,
                artwork: params.artwork ?? existing.artwork,
                description: params.description ?? existing.description,
                sortOrder: params.sortOrder ?? existing.sort_order,
                updatedAt: Date.now(),
            });
            this.broadcastPlaylistEvent({ origin: 'user' });
        });

        ipcMain.handle(IPC.CLEAR_PLAYLIST, (_evt, playlistId: string) => {
            this.queries.clearPlaylistRelations.run(playlistId);
            this.scheduleOrphanCleanup();
            this.broadcastPlaylistEvent({ origin: 'user', sheetId: playlistId });
        });

        // ─── 歌曲操作 ────────────────────────

        ipcMain.handle(
            IPC.ADD_MUSIC,
            (
                _evt,
                playlistId: string,
                musicItems: Array<IMusic.IMusicItem | IMusicItemSlim>,
            ): { added: number; truncated: number } => {
                const currentCount = (this.queries.getPlaylistMusicCount.get(playlistId) as any)
                    .count;
                const remaining = MAX_MUSIC_PER_PLAYLIST - currentCount;
                if (remaining <= 0) {
                    throw new Error(
                        i18n.t('playlist.limit_reached', { count: MAX_MUSIC_PER_PLAYLIST }),
                    );
                }
                const toAdd = musicItems.slice(0, remaining);

                const db = this.db.getDatabase();
                const addMany = db.transaction(
                    (items: Array<IMusic.IMusicItem | IMusicItemSlim>) => {
                        const minOrder = (this.queries.getMinSortOrder.get(playlistId) as any)
                            .minOrder;
                        const startOrder = minOrder - items.length;
                        const now = Date.now();
                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            const sid = String(item.id);
                            this.queries.upsertMusicItem.run({
                                platform: item.platform,
                                id: sid,
                                title: item.title,
                                artist: item.artist ?? '',
                                album: item.album ?? '',
                                duration: item.duration ?? null,
                                artwork: item.artwork ?? null,
                                raw: (item as any)[INTERNAL_SLIM_KEY] ? null : safeStringify(item),
                            });
                            this.queries.insertRelation.run({
                                sheetId: playlistId,
                                platform: item.platform,
                                musicId: sid,
                                sortOrder: startOrder + i,
                                addedAt: now,
                            });
                        }
                    },
                );
                addMany(toAdd);
                this.broadcastPlaylistEvent({ origin: 'user', sheetId: playlistId });
                return { added: toAdd.length, truncated: musicItems.length - toAdd.length };
            },
        );

        ipcMain.handle(
            IPC.REMOVE_MUSIC,
            (_evt, playlistId: string, musicBases: IMedia.IMediaBase[]) => {
                const db = this.db.getDatabase();
                const removeMany = db.transaction((items: IMedia.IMediaBase[]) => {
                    for (const item of items) {
                        this.queries.removeRelation.run({
                            sheetId: playlistId,
                            platform: item.platform,
                            musicId: String(item.id),
                        });
                    }
                });
                removeMany(musicBases);
                this.scheduleOrphanCleanup();
                this.broadcastPlaylistEvent({ origin: 'user', sheetId: playlistId });
            },
        );

        ipcMain.handle(IPC.REMOVE_FROM_ALL_PLAYLISTS, (_evt, musicBases: IMedia.IMediaBase[]) => {
            const db = this.db.getDatabase();
            db.transaction(() => {
                for (const item of musicBases) {
                    this.queries.removeFromAllPlaylists.run({
                        platform: item.platform,
                        musicId: String(item.id),
                        excludeSheetId: PLAY_QUEUE_PLAYLIST_ID,
                    });
                }
            })();
            this.scheduleOrphanCleanup();
            this.broadcastPlaylistEvent({ origin: 'user' });
        });

        ipcMain.handle(
            IPC.UPDATE_MUSIC_ORDER,
            (_evt, playlistId: string, orderedKeys: IMedia.IMediaBase[]) => {
                const db = this.db.getDatabase();
                const reorder = db.transaction((keys: IMedia.IMediaBase[]) => {
                    for (let i = 0; i < keys.length; i++) {
                        this.queries.updateRelationOrder.run({
                            sheetId: playlistId,
                            platform: keys[i].platform,
                            musicId: String(keys[i].id),
                            sortOrder: i,
                        });
                    }
                });
                reorder(orderedKeys);
            },
        );

        ipcMain.handle(
            IPC.GET_RAW_MUSIC_ITEM,
            (_evt, platform: string, id: string): IMusic.IMusicItem | null => {
                const row = this.queries.getMusicItemRaw.get(platform, id) as
                    { raw: string } | undefined;
                return row ? JSON.parse(row.raw) : null;
            },
        );

        ipcMain.handle(
            IPC.GET_RAW_MUSIC_ITEMS,
            (_evt, keys: IMedia.IMediaBase[]): IMusic.IMusicItem[] => {
                const results: IMusic.IMusicItem[] = [];
                for (const k of keys) {
                    const row = this.queries.getMusicItemRaw.get(k.platform, k.id) as
                        { raw: string } | undefined;
                    if (row) {
                        results.push(JSON.parse(row.raw));
                    }
                }
                return results;
            },
        );

        // ─── 星标远程歌单 ────────────────────

        ipcMain.handle(IPC.GET_STARRED_PLAYLISTS, () => {
            return this.queries.getAllStarredPlaylists.all();
        });

        ipcMain.handle(IPC.STAR_PLAYLIST, (_evt, playlist: IMusic.IPlaylistItem) => {
            this.queries.insertStarredPlaylist.run({
                platform: playlist.platform,
                id: String(playlist.id),
                title: playlist.title ?? null,
                artwork: playlist.artwork ?? null,
                raw: JSON.stringify(playlist),
                sortOrder: 0,
                starredAt: Date.now(),
            });
        });

        ipcMain.handle(IPC.UNSTAR_PLAYLIST, (_evt, platform: string, id: string) => {
            this.queries.deleteStarredPlaylist.run({ platform, id });
        });

        ipcMain.handle(IPC.SET_STARRED_ORDER, (_evt, orderedKeys: IMedia.IMediaBase[]) => {
            const db = this.db.getDatabase();
            const reorder = db.transaction((keys: IMedia.IMediaBase[]) => {
                for (let i = 0; i < keys.length; i++) {
                    this.queries.updateStarredOrder.run({
                        platform: keys[i].platform,
                        id: String(keys[i].id),
                        sortOrder: i,
                    });
                }
            });
            reorder(orderedKeys);
        });

        // ─── 播放队列 ────────────────────────

        ipcMain.handle(IPC.PLAY_QUEUE_GET_ALL, () => {
            return this.queries.getPlaylistMusicSlim.all(PLAY_QUEUE_PLAYLIST_ID);
        });

        ipcMain.handle(
            IPC.PLAY_QUEUE_SET,
            (_evt, items: IMusic.IMusicItem[], fromPlaylistId?: string) => {
                const db = this.db.getDatabase();
                db.transaction(() => {
                    this.queries.clearPlaylistRelations.run(PLAY_QUEUE_PLAYLIST_ID);

                    if (fromPlaylistId) {
                        // 性能优化：直接从源歌单复制 relation
                        this.queries.copyRelationsToQueue.run({
                            queueId: PLAY_QUEUE_PLAYLIST_ID,
                            fromSheetId: fromPlaylistId,
                            addedAt: Date.now(),
                        });
                    } else {
                        const now = Date.now();
                        const toAdd = items.slice(0, MAX_QUEUE_SIZE);
                        for (let i = 0; i < toAdd.length; i++) {
                            const item = toAdd[i];
                            const sid = String(item.id);
                            this.queries.upsertMusicItem.run({
                                platform: item.platform,
                                id: sid,
                                title: item.title,
                                artist: item.artist ?? '',
                                album: item.album ?? '',
                                duration: item.duration ?? null,
                                artwork: item.artwork ?? null,
                                raw: (item as any)[INTERNAL_SLIM_KEY] ? null : safeStringify(item),
                            });
                            this.queries.insertRelation.run({
                                sheetId: PLAY_QUEUE_PLAYLIST_ID,
                                platform: item.platform,
                                musicId: sid,
                                sortOrder: i,
                                addedAt: now,
                            });
                        }
                    }
                })();
                this.scheduleOrphanCleanup();
            },
        );

        ipcMain.handle(
            IPC.PLAY_QUEUE_ADD,
            (_evt, items: IMusic.IMusicItem[], afterIndex: number) => {
                const db = this.db.getDatabase();
                db.transaction(() => {
                    const now = Date.now();
                    const count = items.length;

                    // 1. 去重：移除队列中已存在的同名歌曲（与 renderer 内存去重一致）
                    for (const item of items) {
                        this.queries.removeRelation.run({
                            sheetId: PLAY_QUEUE_PLAYLIST_ID,
                            platform: item.platform,
                            musicId: String(item.id),
                        });
                    }

                    // 2. 确定插入点：afterIndex 是去重后数组中的位置
                    const pivot = this.queries.getSortOrderAtPosition.get(
                        PLAY_QUEUE_PLAYLIST_ID,
                        afterIndex,
                    ) as { sortOrder: number } | undefined;

                    let startOrder: number;
                    if (pivot) {
                        // 将 afterIndex 及之后的歌曲后移 count 个位置，腾出空间
                        this.queries.shiftRelationsAfter.run({
                            sheetId: PLAY_QUEUE_PLAYLIST_ID,
                            pivotOrder: pivot.sortOrder,
                            count,
                        });
                        startOrder = pivot.sortOrder;
                    } else {
                        // afterIndex 超出范围 → 追加到末尾
                        startOrder =
                            (this.queries.getMaxSortOrder.get(PLAY_QUEUE_PLAYLIST_ID) as any)
                                .maxOrder + 1;
                    }

                    // 3. 在腾出的空位插入新歌曲
                    for (let i = 0; i < count; i++) {
                        const item = items[i];
                        const sid = String(item.id);
                        this.queries.upsertMusicItem.run({
                            platform: item.platform,
                            id: sid,
                            title: item.title,
                            artist: item.artist ?? '',
                            album: item.album ?? '',
                            duration: item.duration ?? null,
                            artwork: item.artwork ?? null,
                            raw: (item as any)[INTERNAL_SLIM_KEY] ? null : safeStringify(item),
                        });
                        this.queries.insertRelation.run({
                            sheetId: PLAY_QUEUE_PLAYLIST_ID,
                            platform: item.platform,
                            musicId: sid,
                            sortOrder: startOrder + i,
                            addedAt: now,
                        });
                    }
                })();
            },
        );

        ipcMain.handle(IPC.PLAY_QUEUE_REMOVE, (_evt, musicBases: IMedia.IMediaBase[]) => {
            const db = this.db.getDatabase();
            db.transaction(() => {
                for (const item of musicBases) {
                    this.queries.removeRelation.run({
                        sheetId: PLAY_QUEUE_PLAYLIST_ID,
                        platform: item.platform,
                        musicId: String(item.id),
                    });
                }
            })();
            this.scheduleOrphanCleanup();
        });

        ipcMain.handle(IPC.PLAY_QUEUE_CLEAR, () => {
            this.queries.clearPlaylistRelations.run(PLAY_QUEUE_PLAYLIST_ID);
            this.scheduleOrphanCleanup();
        });
    }

    /** 确保 __downloaded__ 系统歌单存在 */
    private ensureDownloadedPlaylist() {
        const exists = this.queries.getPlaylistById.get(DOWNLOADED_PLAYLIST_ID);
        if (!exists) {
            this.queries.insertPlaylist.run({
                id: DOWNLOADED_PLAYLIST_ID,
                title: i18n.t('common.downloaded'),
                artwork: null,
                description: null,
                type: 'system',
                folderPath: null,
                sortOrder: -998,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
    }

    /** 确保默认收藏歌单存在 */
    private ensureDefaultPlaylist() {
        const exists = this.queries.getPlaylistById.get(DEFAULT_FAVORITE_PLAYLIST_ID);
        if (!exists) {
            this.queries.insertPlaylist.run({
                id: DEFAULT_FAVORITE_PLAYLIST_ID,
                title: i18n.t('media.default_favorite_sheet_name'),
                artwork: null,
                description: null,
                type: 'user',
                folderPath: null,
                sortOrder: -1, // 永远排第一
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
    }

    /** 确保播放队列虚拟歌单存在 */
    private ensurePlayQueuePlaylist() {
        const exists = this.queries.getPlaylistById.get(PLAY_QUEUE_PLAYLIST_ID);
        if (!exists) {
            this.queries.insertPlaylist.run({
                id: PLAY_QUEUE_PLAYLIST_ID,
                title: i18n.t('playback.queue_title'),
                artwork: null,
                description: null,
                type: 'system',
                folderPath: null,
                sortOrder: -999, // 系统歌单，不参与排序
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
    }

    /**
     * 广播 musicSheet 事件。
     * - origin: 'user' 表示 renderer 用户操作触发，乐观更新已处理 musicList；
     * - origin: 'internal' 表示 main 内部模块触发，renderer 需拉取 musicList。
     */
    private broadcastPlaylistEvent(event: IPlaylistEvent) {
        this.windowManager.broadcast(IPC.PLAYLIST_EVENT, event);
    }

    /** 延迟清理不被任何歌单引用的歌曲（避免频繁执行） */
    private scheduleOrphanCleanup() {
        if (this.orphanCleanupTimer) return;
        this.orphanCleanupTimer = setTimeout(() => {
            this.queries.cleanOrphanMusic.run();
            this.orphanCleanupTimer = null;
        }, 5000);
    }
}

/** 库里已有歌曲的一行（恢复备份时作为合并的底） */
interface IRestoreBaseRow {
    platform: string;
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number | null;
    artwork: string | null;
    raw: string | null;
}

/**
 * 恢复备份时一首歌最终写库的数据，展示列与完整数据都用这一份：
 * 以库里已有的完整数据为底，叠加备份曲目的字段；标题、歌手、专辑、时长、封面
 * 依次取备份、已有展示列、已有完整数据中第一个可用的值，都没有时文本字段为空串。
 */
function mergeRestoredItem(item: IMusic.IMusicItem, existing?: IRestoreBaseRow): IMusic.IMusicItem {
    const backup = item as unknown as Record<string, unknown>;
    const raw = existing ? parseRaw(existing.raw) : {};
    const columns = existing ? (existing as unknown as Record<string, unknown>) : {};
    const merged: Record<string, unknown> = { ...raw, ...backup };
    // 逐字段取第一个可用的值：备份 → 已有展示列（每次写入都会更新）→ 已有完整数据；库里的空值视为没有
    const existingSources = [columns, raw];
    for (const key of ['title', 'artist', 'album'] as const) {
        merged[key] =
            toRestorableText(backup[key]) ??
            firstOf(existingSources, key, (v) => nonEmpty(toRestorableText(v))) ??
            '';
    }
    const duration =
        toRestorableDuration(backup.duration) ??
        firstOf(existingSources, 'duration', toRestorableDuration);
    if (duration === null) delete merged.duration;
    else merged.duration = duration;
    const artwork = firstOf([backup, ...existingSources], 'artwork', (v) =>
        typeof v === 'string' ? nonEmpty(v) : null,
    );
    if (artwork === null) delete merged.artwork;
    else merged.artwork = artwork;
    return merged as unknown as IMusic.IMusicItem;
}

function nonEmpty(value: string | null): string | null {
    return value !== null && value.trim() !== '' ? value : null;
}

function firstOf<T>(
    sources: Record<string, unknown>[],
    key: string,
    convert: (value: unknown) => T | null,
): T | null {
    for (const source of sources) {
        const value = convert(source[key]);
        if (value !== null) return value;
    }
    return null;
}

/** 已有歌曲的完整数据；没有或无法解析为对象时为空 */
function parseRaw(raw: string | null): Record<string, unknown> {
    const parsed = raw ? safeParse<unknown>(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
}

function toRestorableText(value: unknown): string | null {
    if (typeof value === 'string') return value;
    return Number.isFinite(value) ? String(value) : null;
}

function toRestorableDuration(value: unknown): number | null {
    const duration = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return Number.isFinite(duration) ? (duration as number) : null;
}

/** slim 展示列 → 歌曲条目（空值字段省略） */
function slimToMusicItem(slim: IMusicItemSlim): IMusic.IMusicItem {
    const { duration, artwork, ...rest } = slim;
    return {
        ...rest,
        ...(duration != null ? { duration } : {}),
        ...(artwork != null ? { artwork } : {}),
    } as IMusic.IMusicItem;
}

const playlistManager = new PlaylistManager();
export default playlistManager;
