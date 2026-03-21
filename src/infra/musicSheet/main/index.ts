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
    ICreateSheetParams,
    IUpdateSheetParams,
    ILocalSheetMeta,
    ILocalSheetDetail,
    IMusicItemSlim,
} from '@appTypes/infra/musicSheet';
import {
    IPC,
    MAX_MUSIC_PER_SHEET,
    MAX_QUEUE_SIZE,
    DEFAULT_FAVORITE_SHEET_ID,
    PLAY_QUEUE_SHEET_ID,
    DOWNLOADED_SHEET_ID,
    type IMusicSheetEvent,
} from '../common/constant';
import { createQueries, type IMusicSheetQueries } from './queries';
import { INTERNAL_SLIM_KEY } from '@common/constant';
import { safeStringify, safeParse } from '@common/safeSerialize';
import type { IBackupProvider, IBackupSheet, RestoreMode } from '@appTypes/infra/backup';

class MusicSheetManager {
    private isSetup = false;
    private db!: IDatabaseProvider;
    private queries!: IMusicSheetQueries;
    private windowManager!: IWindowManager;
    private orphanCleanupTimer: ReturnType<typeof setTimeout> | null = null;

    public setup(deps: { db: IDatabaseProvider; windowManager: IWindowManager }) {
        if (this.isSetup) return;

        this.db = deps.db;
        const db = deps.db.getDatabase();
        this.queries = createQueries(db);
        this.windowManager = deps.windowManager;

        this.ensureDefaultSheet();
        this.ensurePlayQueueSheet();
        this.ensureDownloadedSheet();

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
    public addMusicToSheet(musicItem: IMusic.IMusicItem | IMusicItemSlim, sheetId: string): void {
        const db = this.db.getDatabase();
        db.transaction(() => {
            const minOrder = (this.queries.getMinSortOrder.get(sheetId) as any).minOrder;
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
                sheetId,
                platform: musicItem.platform,
                musicId: sid,
                sortOrder: minOrder - 1,
                addedAt: now,
            });
        })();
        this.broadcastMusicSheetEvent({ origin: 'internal', sheetId });
    }

    /**
     * 从指定歌单移除歌曲。
     * 主进程内部调用，不通过 IPC。
     */
    public removeMusicFromSheet(platform: string, musicId: string, sheetId: string): void {
        this.queries.removeRelation.run({
            sheetId,
            platform,
            musicId: String(musicId),
        });
        this.scheduleOrphanCleanup();
        this.broadcastMusicSheetEvent({ origin: 'internal', sheetId });
    }

    /**
     * 返回 downloadManager 所需的 DI 适配器。
     * 封装了对 __downloaded__ 歌单的 addMusicToSheet / removeMusicFromSheet 调用。
     */
    public getDownloadedSheetProvider() {
        return {
            addMusicToDownloaded: (musicItem: IMusic.IMusicItem) => {
                this.addMusicToSheet(musicItem, DOWNLOADED_SHEET_ID);
            },
            removeFromDownloaded: (platform: string, musicId: string) => {
                this.removeMusicFromSheet(platform, musicId, DOWNLOADED_SHEET_ID);
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
                    | { raw: string | null }
                    | undefined;
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
            getExportableSheets: (): Array<{ id: string; title: string }> => {
                return (this.queries.getAllSheets.all() as ILocalSheetMeta[]).filter(
                    (s) => s.type !== 'system',
                );
            },

            /** 获取指定歌单内全量 raw 数据 */
            getSheetMusicRaw: (sheetId: string): IMusic.IMusicItem[] => {
                return (this.queries.getSheetMusicRaw.all(sheetId) as { raw: string }[]).map(
                    (row) => safeParse<IMusic.IMusicItem>(row.raw)!,
                );
            },

            /**
             * 导入歌单数据。整个操作在单一 SQLite 事务中完成。
             * @param sheets - 待导入的歌单数组
             * @param mode - 'append' | 'overwrite'
             * @param onProgress - 进度回调（按歌单粒度）
             */
            importSheets: (
                sheets: IBackupSheet[],
                mode: RestoreMode,
                onProgress?: (current: number, total: number, sheetTitle: string) => void,
            ): { sheetsCount: number; songsCount: number } => {
                const db = this.db.getDatabase();
                let totalSongs = 0;

                // overwrite 清理在单独事务中执行
                if (mode === 'overwrite') {
                    db.transaction(() => {
                        const userSheets = (
                            this.queries.getAllSheets.all() as ILocalSheetMeta[]
                        ).filter((s) => s.type !== 'system' && s.id !== DEFAULT_FAVORITE_SHEET_ID);
                        for (const sheet of userSheets) {
                            this.queries.clearSheetRelations.run(sheet.id);
                            this.queries.deleteSheet.run(sheet.id);
                        }
                        this.queries.clearSheetRelations.run(DEFAULT_FAVORITE_SHEET_ID);
                    })();
                }

                // 按歌单粒度拆分事务，让进度事件能实时到达 renderer
                for (let i = 0; i < sheets.length; i++) {
                    const sheet = sheets[i];
                    onProgress?.(i + 1, sheets.length, sheet.title);

                    db.transaction(() => {
                        let targetSheetId: string;

                        if (sheet.id === DEFAULT_FAVORITE_SHEET_ID) {
                            targetSheetId = DEFAULT_FAVORITE_SHEET_ID;
                        } else {
                            targetSheetId = nanoid();
                            this.queries.insertSheet.run({
                                id: targetSheetId,
                                title: sheet.title,
                                artwork: null,
                                description: null,
                                type: 'user',
                                folderPath: null,
                                sortOrder: 0,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            });
                        }

                        let maxOrder = (this.queries.getMaxSortOrder.get(targetSheetId) as any)
                            .maxOrder;
                        const now = Date.now();
                        for (const item of sheet.musicList) {
                            const sid = String(item.id);
                            this.queries.upsertMusicItem.run({
                                platform: item.platform,
                                id: sid,
                                title: item.title,
                                artist: item.artist ?? '',
                                album: item.album ?? '',
                                duration: item.duration ?? null,
                                artwork: item.artwork ?? null,
                                raw: safeStringify(item),
                            });
                            this.queries.insertRelation.run({
                                sheetId: targetSheetId,
                                platform: item.platform,
                                musicId: sid,
                                sortOrder: ++maxOrder,
                                addedAt: now,
                            });
                        }
                        totalSongs += sheet.musicList.length;
                    })();
                }

                this.scheduleOrphanCleanup();
                this.broadcastMusicSheetEvent({ origin: 'internal' });

                return { sheetsCount: sheets.length, songsCount: totalSongs };
            },
        };
    }

    private registerIpcHandlers() {
        // ─── 歌单 CRUD ────────────────────────

        ipcMain.handle(IPC.GET_ALL_SHEETS, (): ILocalSheetMeta[] => {
            return (this.queries.getAllSheets.all() as ILocalSheetMeta[]).filter(
                (s) => s.type !== 'system',
            );
        });

        ipcMain.handle(IPC.GET_SHEET_DETAIL, (_evt, sheetId: string): ILocalSheetDetail | null => {
            const sheet = this.queries.getSheetById.get(sheetId) as ILocalSheetMeta | undefined;
            if (!sheet) return null;
            const musicList = this.queries.getSheetMusicSlim.all(sheetId);
            return { ...sheet, musicList } as ILocalSheetDetail;
        });

        ipcMain.handle(IPC.CREATE_SHEET, (_evt, params: ICreateSheetParams): ILocalSheetMeta => {
            const now = Date.now();
            const sheet = {
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
            this.queries.insertSheet.run(sheet);
            this.broadcastMusicSheetEvent({ origin: 'user' });
            return { ...sheet, worksNum: 0, latestArtwork: null } as ILocalSheetMeta;
        });

        ipcMain.handle(IPC.DELETE_SHEET, (_evt, sheetId: string) => {
            if (sheetId === DEFAULT_FAVORITE_SHEET_ID) {
                throw new Error(i18n.t('playlist.cannot_delete_favorite'));
            }
            if (sheetId === PLAY_QUEUE_SHEET_ID) {
                throw new Error(i18n.t('playlist.cannot_delete_system'));
            }
            this.queries.clearSheetRelations.run(sheetId);
            this.queries.deleteSheet.run(sheetId);
            this.scheduleOrphanCleanup();
            this.broadcastMusicSheetEvent({ origin: 'user' });
        });

        ipcMain.handle(IPC.UPDATE_SHEET, (_evt, params: IUpdateSheetParams) => {
            const existing = this.queries.getSheetById.get(params.id) as
                | Record<string, unknown>
                | undefined;
            if (!existing) return;

            this.queries.updateSheet.run({
                id: params.id,
                title: params.title ?? existing.title,
                artwork: params.artwork ?? existing.artwork,
                description: params.description ?? existing.description,
                sortOrder: params.sortOrder ?? existing.sort_order,
                updatedAt: Date.now(),
            });
            this.broadcastMusicSheetEvent({ origin: 'user' });
        });

        ipcMain.handle(IPC.CLEAR_SHEET, (_evt, sheetId: string) => {
            this.queries.clearSheetRelations.run(sheetId);
            this.scheduleOrphanCleanup();
            this.broadcastMusicSheetEvent({ origin: 'user', sheetId });
        });

        // ─── 歌曲操作 ────────────────────────

        ipcMain.handle(
            IPC.ADD_MUSIC,
            (
                _evt,
                sheetId: string,
                musicItems: Array<IMusic.IMusicItem | IMusicItemSlim>,
            ): { added: number; truncated: number } => {
                const currentCount = (this.queries.getSheetMusicCount.get(sheetId) as any).count;
                const remaining = MAX_MUSIC_PER_SHEET - currentCount;
                if (remaining <= 0) {
                    throw new Error(
                        i18n.t('playlist.limit_reached', { count: MAX_MUSIC_PER_SHEET }),
                    );
                }
                const toAdd = musicItems.slice(0, remaining);

                const db = this.db.getDatabase();
                const addMany = db.transaction(
                    (items: Array<IMusic.IMusicItem | IMusicItemSlim>) => {
                        const minOrder = (this.queries.getMinSortOrder.get(sheetId) as any)
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
                                sheetId,
                                platform: item.platform,
                                musicId: sid,
                                sortOrder: startOrder + i,
                                addedAt: now,
                            });
                        }
                    },
                );
                addMany(toAdd);
                this.broadcastMusicSheetEvent({ origin: 'user', sheetId });
                return { added: toAdd.length, truncated: musicItems.length - toAdd.length };
            },
        );

        ipcMain.handle(
            IPC.REMOVE_MUSIC,
            (_evt, sheetId: string, musicBases: IMedia.IMediaBase[]) => {
                const db = this.db.getDatabase();
                const removeMany = db.transaction((items: IMedia.IMediaBase[]) => {
                    for (const item of items) {
                        this.queries.removeRelation.run({
                            sheetId,
                            platform: item.platform,
                            musicId: String(item.id),
                        });
                    }
                });
                removeMany(musicBases);
                this.scheduleOrphanCleanup();
                this.broadcastMusicSheetEvent({ origin: 'user', sheetId });
            },
        );

        ipcMain.handle(IPC.REMOVE_FROM_ALL_SHEETS, (_evt, musicBases: IMedia.IMediaBase[]) => {
            const db = this.db.getDatabase();
            db.transaction(() => {
                for (const item of musicBases) {
                    this.queries.removeFromAllSheets.run({
                        platform: item.platform,
                        musicId: String(item.id),
                        excludeSheetId: PLAY_QUEUE_SHEET_ID,
                    });
                }
            })();
            this.scheduleOrphanCleanup();
            this.broadcastMusicSheetEvent({ origin: 'user' });
        });

        ipcMain.handle(
            IPC.UPDATE_MUSIC_ORDER,
            (_evt, sheetId: string, orderedKeys: IMedia.IMediaBase[]) => {
                const db = this.db.getDatabase();
                const reorder = db.transaction((keys: IMedia.IMediaBase[]) => {
                    for (let i = 0; i < keys.length; i++) {
                        this.queries.updateRelationOrder.run({
                            sheetId,
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
                    | { raw: string }
                    | undefined;
                return row ? JSON.parse(row.raw) : null;
            },
        );

        ipcMain.handle(
            IPC.GET_RAW_MUSIC_ITEMS,
            (_evt, keys: IMedia.IMediaBase[]): IMusic.IMusicItem[] => {
                const results: IMusic.IMusicItem[] = [];
                for (const k of keys) {
                    const row = this.queries.getMusicItemRaw.get(k.platform, k.id) as
                        | { raw: string }
                        | undefined;
                    if (row) {
                        results.push(JSON.parse(row.raw));
                    }
                }
                return results;
            },
        );

        // ─── 星标远程歌单 ────────────────────

        ipcMain.handle(IPC.GET_STARRED_SHEETS, () => {
            return this.queries.getAllStarredSheets.all();
        });

        ipcMain.handle(IPC.STAR_SHEET, (_evt, sheet: IMusic.IMusicSheetItem) => {
            this.queries.insertStarredSheet.run({
                platform: sheet.platform,
                id: String(sheet.id),
                title: sheet.title ?? null,
                artwork: sheet.artwork ?? null,
                raw: JSON.stringify(sheet),
                sortOrder: 0,
                starredAt: Date.now(),
            });
        });

        ipcMain.handle(IPC.UNSTAR_SHEET, (_evt, platform: string, id: string) => {
            this.queries.deleteStarredSheet.run({ platform, id });
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
            return this.queries.getSheetMusicSlim.all(PLAY_QUEUE_SHEET_ID);
        });

        ipcMain.handle(
            IPC.PLAY_QUEUE_SET,
            (_evt, items: IMusic.IMusicItem[], fromSheetId?: string) => {
                const db = this.db.getDatabase();
                db.transaction(() => {
                    this.queries.clearSheetRelations.run(PLAY_QUEUE_SHEET_ID);

                    if (fromSheetId) {
                        // 性能优化：直接从源歌单复制 relation
                        this.queries.copyRelationsToQueue.run({
                            queueId: PLAY_QUEUE_SHEET_ID,
                            fromSheetId,
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
                                sheetId: PLAY_QUEUE_SHEET_ID,
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
                            sheetId: PLAY_QUEUE_SHEET_ID,
                            platform: item.platform,
                            musicId: String(item.id),
                        });
                    }

                    // 2. 确定插入点：afterIndex 是去重后数组中的位置
                    const pivot = this.queries.getSortOrderAtPosition.get(
                        PLAY_QUEUE_SHEET_ID,
                        afterIndex,
                    ) as { sortOrder: number } | undefined;

                    let startOrder: number;
                    if (pivot) {
                        // 将 afterIndex 及之后的歌曲后移 count 个位置，腾出空间
                        this.queries.shiftRelationsAfter.run({
                            sheetId: PLAY_QUEUE_SHEET_ID,
                            pivotOrder: pivot.sortOrder,
                            count,
                        });
                        startOrder = pivot.sortOrder;
                    } else {
                        // afterIndex 超出范围 → 追加到末尾
                        startOrder =
                            (this.queries.getMaxSortOrder.get(PLAY_QUEUE_SHEET_ID) as any)
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
                            sheetId: PLAY_QUEUE_SHEET_ID,
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
                        sheetId: PLAY_QUEUE_SHEET_ID,
                        platform: item.platform,
                        musicId: String(item.id),
                    });
                }
            })();
            this.scheduleOrphanCleanup();
        });

        ipcMain.handle(IPC.PLAY_QUEUE_CLEAR, () => {
            this.queries.clearSheetRelations.run(PLAY_QUEUE_SHEET_ID);
            this.scheduleOrphanCleanup();
        });
    }

    /** 确保 __downloaded__ 系统歌单存在 */
    private ensureDownloadedSheet() {
        const exists = this.queries.getSheetById.get(DOWNLOADED_SHEET_ID);
        if (!exists) {
            this.queries.insertSheet.run({
                id: DOWNLOADED_SHEET_ID,
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
    private ensureDefaultSheet() {
        const exists = this.queries.getSheetById.get(DEFAULT_FAVORITE_SHEET_ID);
        if (!exists) {
            this.queries.insertSheet.run({
                id: DEFAULT_FAVORITE_SHEET_ID,
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
    private ensurePlayQueueSheet() {
        const exists = this.queries.getSheetById.get(PLAY_QUEUE_SHEET_ID);
        if (!exists) {
            this.queries.insertSheet.run({
                id: PLAY_QUEUE_SHEET_ID,
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
    private broadcastMusicSheetEvent(event: IMusicSheetEvent) {
        this.windowManager.broadcast(IPC.MUSIC_SHEET_EVENT, event);
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

const musicSheet = new MusicSheetManager();
export default musicSheet;
