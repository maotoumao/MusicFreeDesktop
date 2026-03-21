/**
 * localMusic — 主进程层
 *
 * 职责：
 * - 扫描文件夹管理（增删改查）
 * - 增量扫描（文件发现 → diff → metadata 解析 → DB 写入）
 * - IPC 注册（handle + broadcast）
 * - local_music → IMusicItem 转换（含 folder 字段，供渲染进程客户端聚合）
 * - 启动后 60s 空闲静默 rescan
 */

import { ipcMain, shell } from 'electron';
import { nanoid } from 'nanoid';
import path from 'path';
import type Database from 'better-sqlite3';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IDatabaseProvider } from '@appTypes/infra/database';
import type { IAppConfigReader } from '@appTypes/infra/appConfig';
import type {
    ILocalMusicItem,
    IScanFolder,
    IScanProgress,
    IScanResult,
} from '@appTypes/infra/localMusic';
import type { IMediaMetaProvider } from '@appTypes/infra/mediaMeta';
import { LOCAL_PLUGIN_NAME, INTERNAL_SLIM_KEY } from '@common/constant';
import { pathToFileURL } from 'url';
import { IPC, SCAN_BATCH_SIZE } from '../common/constant';
import { discoverAudioFiles, diffWithDb } from './scanner';
import { parseFileMetadata } from './metadataParser';

// ─── Prepared Statements ───

interface ILocalMusicQueries {
    getAllScanFolders: Database.Statement;
    insertScanFolder: Database.Statement;
    deleteScanFolder: Database.Statement;
    updateScanFolderLastScan: Database.Statement;

    upsertLocalMusic: Database.Statement;
    deleteLocalMusic: Database.Statement;
    deleteLocalMusicByScanFolder: Database.Statement;
    deleteLocalMusicByKey: Database.Statement;
    getFilePathByMusicKey: Database.Statement;
    getLocalMusicByScanFolder: Database.Statement;

    getAllMusic: Database.Statement;
}

function createQueries(db: Database.Database): ILocalMusicQueries {
    return {
        // ─── scan_folders ───
        getAllScanFolders: db.prepare(
            'SELECT id, folder_path AS folderPath, last_scan_at AS lastScanAt, created_at AS createdAt FROM scan_folders ORDER BY created_at ASC',
        ),
        insertScanFolder: db.prepare(
            'INSERT INTO scan_folders (id, folder_path, created_at) VALUES (@id, @folderPath, @createdAt)',
        ),
        deleteScanFolder: db.prepare('DELETE FROM scan_folders WHERE id = ?'),
        updateScanFolderLastScan: db.prepare(
            'UPDATE scan_folders SET last_scan_at = @lastScanAt WHERE id = @id',
        ),

        // ─── local_music CRUD ───
        upsertLocalMusic: db.prepare(`
            INSERT INTO local_music
                (file_path, platform, music_id, title, artist, album, duration, artwork,
                 folder, file_size, file_mtime, scan_folder_id, created_at)
            VALUES
                (@filePath, @platform, @id, @title, @artist, @album, @duration, @artwork,
                 @folder, @fileSize, @fileMtime, @scanFolderId, @createdAt)
            ON CONFLICT(file_path) DO UPDATE SET
                platform = excluded.platform,
                music_id = excluded.music_id,
                title = excluded.title,
                artist = excluded.artist,
                album = excluded.album,
                duration = excluded.duration,
                artwork = COALESCE(excluded.artwork, artwork),
                folder = excluded.folder,
                file_size = excluded.file_size,
                file_mtime = excluded.file_mtime,
                scan_folder_id = excluded.scan_folder_id
        `),
        deleteLocalMusic: db.prepare('DELETE FROM local_music WHERE file_path = ?'),
        deleteLocalMusicByScanFolder: db.prepare(
            'DELETE FROM local_music WHERE scan_folder_id = ?',
        ),
        deleteLocalMusicByKey: db.prepare(
            'DELETE FROM local_music WHERE platform = ? AND music_id = ?',
        ),
        getFilePathByMusicKey: db.prepare(
            'SELECT file_path AS filePath FROM local_music WHERE platform = ? AND music_id = ?',
        ),
        getLocalMusicByScanFolder: db.prepare(
            'SELECT file_path, file_size, file_mtime FROM local_music WHERE scan_folder_id = ?',
        ),

        // ─── 全量查歌曲列表 ───
        getAllMusic: db.prepare(`
            SELECT file_path AS filePath, platform, music_id AS id, title, artist, album,
                   duration, artwork, folder, file_size AS fileSize, file_mtime AS fileMtime,
                   scan_folder_id AS scanFolderId, created_at AS createdAt
            FROM local_music ORDER BY title
        `),
    };
}

// ─── LocalMusicManager ───

class LocalMusicManager {
    private isSetup = false;
    private db!: IDatabaseProvider;
    private windowManager!: IWindowManager;
    private appConfig!: IAppConfigReader;
    private mediaMeta!: IMediaMetaProvider;
    private queries!: ILocalMusicQueries;
    private isScanning = false;
    private cancelledFolderIds = new Set<string>();
    private scanQueue: Array<{
        scanFolderId: string;
        folderPath: string;
        callbacks: Array<{
            resolve: (result: IScanResult) => void;
            reject: (error: unknown) => void;
        }>;
    }> = [];

    public setup(deps: {
        db: IDatabaseProvider;
        windowManager: IWindowManager;
        appConfig: IAppConfigReader;
        mediaMeta: IMediaMetaProvider;
    }) {
        if (this.isSetup) return;
        this.db = deps.db;
        this.windowManager = deps.windowManager;
        this.appConfig = deps.appConfig;
        this.mediaMeta = deps.mediaMeta;

        const db = deps.db.getDatabase();
        this.queries = createQueries(db);

        this.registerIpcHandlers();

        // 启动后 60s 空闲静默 rescan
        setTimeout(() => {
            this.idleRescan();
        }, 60_000);

        this.isSetup = true;
    }

    private registerIpcHandlers() {
        // ─── 扫描文件夹管理 ───

        ipcMain.handle(IPC.GET_SCAN_FOLDERS, (): IScanFolder[] => {
            return this.queries.getAllScanFolders.all() as IScanFolder[];
        });

        ipcMain.handle(
            IPC.SYNC_SCAN_FOLDERS,
            async (_evt, folderPaths: string[]): Promise<IScanResult> => {
                // 1. 规范化输入路径，并以 lowercase 作为比较键（Windows 不区分大小写）
                const inputNormalized = folderPaths.map((fp) => path.normalize(fp));
                const inputSet = new Map(inputNormalized.map((fp) => [fp.toLowerCase(), fp]));

                // 2. 读取 DB 当前状态
                const dbFolders = this.queries.getAllScanFolders.all() as IScanFolder[];
                const dbMap = new Map(
                    dbFolders.map((f) => [path.normalize(f.folderPath).toLowerCase(), f]),
                );

                // 3. 计算 diff
                const toAdd: string[] = [];
                for (const [key, fp] of inputSet) {
                    if (!dbMap.has(key)) {
                        toAdd.push(fp);
                    }
                }
                const toRemove: IScanFolder[] = [];
                for (const [key, folder] of dbMap) {
                    if (!inputSet.has(key)) {
                        toRemove.push(folder);
                    }
                }

                // 4. 原子提交 DB 增删
                const db = this.db.getDatabase();

                db.transaction(() => {
                    // 删除
                    for (const folder of toRemove) {
                        // 取消队列中的待扫描请求
                        const queueIdx = this.scanQueue.findIndex(
                            (q) => q.scanFolderId === folder.id,
                        );
                        if (queueIdx !== -1) {
                            const removed = this.scanQueue.splice(queueIdx, 1)[0];
                            const cancelResult: IScanResult = {
                                added: 0,
                                updated: 0,
                                removed: 0,
                                unchanged: 0,
                                elapsed: 0,
                            };
                            removed.callbacks.forEach((cb) => cb.resolve(cancelResult));
                        } else {
                            this.cancelledFolderIds.add(folder.id);
                        }
                        this.queries.deleteLocalMusicByScanFolder.run(folder.id);
                        this.queries.deleteScanFolder.run(folder.id);
                    }
                    // 新增
                    for (const fp of toAdd) {
                        const id = nanoid();
                        this.queries.insertScanFolder.run({
                            id,
                            folderPath: fp,
                            createdAt: Date.now(),
                        });
                    }
                })();

                // 5. 扫描全部最终文件夹（新增 + 保留）
                const finalFolders = this.queries.getAllScanFolders.all() as IScanFolder[];
                const totalResult: IScanResult = {
                    added: 0,
                    updated: 0,
                    removed: 0,
                    unchanged: 0,
                    elapsed: 0,
                };

                for (const folder of finalFolders) {
                    const result = await this.enqueueScan(folder.id, folder.folderPath);
                    totalResult.added += result.added;
                    totalResult.updated += result.updated;
                    totalResult.removed += result.removed;
                    totalResult.unchanged += result.unchanged;
                    totalResult.elapsed += result.elapsed;
                    this.queries.updateScanFolderLastScan.run({
                        id: folder.id,
                        lastScanAt: Date.now(),
                    });
                }

                this.broadcastLibraryChanged();
                return totalResult;
            },
        );

        // ─── 获取全量 IMusicItem[]（Preload 缓存用） ───

        ipcMain.handle(IPC.GET_ALL_MUSIC_ITEMS, (): IMusic.IMusicItem[] => {
            const rows = this.queries.getAllMusic.all() as ILocalMusicItem[];
            return this.toMusicItems(rows);
        });

        ipcMain.handle(
            IPC.DELETE_ITEMS,
            async (_evt, musicBases: IMedia.IMediaBase[]): Promise<void> => {
                // 1. 查找对应的文件路径并移至回收站
                for (const base of musicBases) {
                    const row = this.queries.getFilePathByMusicKey.get(
                        base.platform,
                        String(base.id),
                    ) as { filePath: string } | undefined;
                    if (row?.filePath) {
                        try {
                            await shell.trashItem(row.filePath);
                        } catch {
                            // 文件可能已不存在，忽略
                        }
                    }
                }

                // 2. 删除 DB 记录
                const db = this.db.getDatabase();
                db.transaction(() => {
                    for (const base of musicBases) {
                        this.queries.deleteLocalMusicByKey.run(base.platform, String(base.id));
                    }
                })();

                this.broadcastLibraryChanged();
            },
        );
    }

    // ─── 扫描队列 ───

    /**
     * 将扫描请求加入队列。
     * 保证全局同一时刻最多只有一个 scanFolder 在执行。
     */
    private enqueueScan(scanFolderId: string, folderPath: string): Promise<IScanResult> {
        return new Promise<IScanResult>((resolve, reject) => {
            const pending = this.scanQueue.find((q) => q.scanFolderId === scanFolderId);
            if (pending) {
                pending.callbacks.push({ resolve, reject });
                return;
            }
            this.scanQueue.push({
                scanFolderId,
                folderPath,
                callbacks: [{ resolve, reject }],
            });
            this.drainQueue();
        });
    }

    private drainQueue() {
        if (this.isScanning || this.scanQueue.length === 0) {
            if (!this.isScanning && this.scanQueue.length === 0) {
                this.broadcastProgress({ phase: 'done', scanned: 0, total: 0 });
            }
            return;
        }
        const next = this.scanQueue.shift()!;
        this.scanFolder(next.scanFolderId, next.folderPath)
            .then(
                (result) => next.callbacks.forEach((cb) => cb.resolve(result)),
                (error) => next.callbacks.forEach((cb) => cb.reject(error)),
            )
            .finally(() => {
                this.drainQueue();
            });
    }

    // ─── 核心：增量扫描 ───

    private async scanFolder(scanFolderId: string, folderPath: string): Promise<IScanResult> {
        this.isScanning = true;
        const startTime = Date.now();

        const excludedPaths = this.appConfig.getConfigByKey('localMusic.excludedPaths') ?? [];

        try {
            // Phase 1: 发现文件
            this.broadcastProgress({
                phase: 'discovering',
                scanned: 0,
                total: 0,
            });
            const diskFiles = await discoverAudioFiles(folderPath, excludedPaths);

            // Phase 2: 增量 diff
            this.broadcastProgress({
                phase: 'diffing',
                scanned: 0,
                total: diskFiles.length,
            });
            const dbRows = this.queries.getLocalMusicByScanFolder.all(scanFolderId) as Array<{
                file_path: string;
                file_size: number | null;
                file_mtime: number | null;
            }>;
            const diff = diffWithDb(diskFiles, dbRows);

            // Phase 3: 解析新增/变更文件的 metadata
            const toProcess = [...diff.added, ...diff.changed];
            const db = this.db.getDatabase();

            for (let i = 0; i < toProcess.length; i += SCAN_BATCH_SIZE) {
                const batch = toProcess.slice(i, i + SCAN_BATCH_SIZE);
                const items: ILocalMusicItem[] = [];

                for (const file of batch) {
                    try {
                        const item = await parseFileMetadata(
                            file.filePath,
                            file.size,
                            file.mtime,
                            scanFolderId,
                            this.mediaMeta,
                        );
                        items.push(item);
                    } catch {
                        /* 跳过解析失败的文件 */
                    }
                }

                // 批量写入 DB（事务）
                if (items.length > 0 && !this.cancelledFolderIds.has(scanFolderId)) {
                    db.transaction(() => {
                        for (const item of items) {
                            this.queries.upsertLocalMusic.run({
                                filePath: item.filePath,
                                platform: item.platform,
                                id: item.id,
                                title: item.title,
                                artist: item.artist,
                                album: item.album,
                                duration: item.duration,
                                artwork: item.artwork,
                                folder: item.folder,
                                fileSize: item.fileSize,
                                fileMtime: item.fileMtime,
                                scanFolderId: item.scanFolderId,
                                createdAt: item.createdAt,
                            });
                        }
                    })();
                }

                this.broadcastProgress({
                    phase: 'parsing',
                    scanned: Math.min(i + SCAN_BATCH_SIZE, toProcess.length),
                    total: toProcess.length,
                    current: batch[batch.length - 1]?.filePath,
                });

                // 让出事件循环
                await new Promise((resolve) => setImmediate(resolve));
            }

            // Phase 4: 删除已不存在的文件
            if (diff.removed.length > 0 && !this.cancelledFolderIds.has(scanFolderId)) {
                db.transaction(() => {
                    for (const fp of diff.removed) {
                        this.queries.deleteLocalMusic.run(fp);
                    }
                })();
            }

            return {
                added: diff.added.length,
                updated: diff.changed.length,
                removed: diff.removed.length,
                unchanged: diff.unchanged,
                elapsed: Date.now() - startTime,
            };
        } finally {
            this.isScanning = false;
            this.cancelledFolderIds.delete(scanFolderId);
        }
    }

    // ─── local_music → IMusicItem 转换 ───

    private toMusicItems(rows: ILocalMusicItem[]): IMusic.IMusicItem[] {
        return rows.map((row) => this.toMusicItem(row));
    }

    /**
     * 将 local_music 行转为 IMusicItem。
     *
     * - 纯本地歌（platform = '本地'）→ url = file://path，不设 $slim
     * - App 下载的歌 → $slim: true 保护已有 raw，不写 url
     */
    private toMusicItem(row: ILocalMusicItem): IMusic.IMusicItem {
        if (row.platform === LOCAL_PLUGIN_NAME) {
            return {
                platform: row.platform,
                id: row.id,
                title: row.title,
                artist: row.artist,
                album: row.album,
                duration: row.duration ?? undefined,
                artwork: row.artwork ?? undefined,
                url: pathToFileURL(row.filePath).toString(),
                localPath: row.filePath,
                folder: row.folder,
            } as IMusic.IMusicItem;
        }
        return {
            platform: row.platform,
            id: row.id,
            title: row.title,
            artist: row.artist,
            album: row.album,
            duration: row.duration ?? undefined,
            artwork: row.artwork ?? undefined,
            [INTERNAL_SLIM_KEY]: true,
            folder: row.folder,
            localPath: row.filePath,
        } as IMusic.IMusicItem;
    }

    private broadcastProgress(progress: IScanProgress) {
        this.windowManager.broadcast(IPC.SCAN_PROGRESS, progress);
    }

    private broadcastLibraryChanged() {
        this.windowManager.broadcast(IPC.LIBRARY_CHANGED);
    }

    /**
     * 空闲 rescan：启动后 60s 扫描所有文件夹。
     */
    private async idleRescan() {
        const folders = this.queries.getAllScanFolders.all() as IScanFolder[];
        if (folders.length === 0) return;

        let hasChanges = false;
        for (const folder of folders) {
            try {
                const result = await this.enqueueScan(folder.id, folder.folderPath);
                if (result.added > 0 || result.updated > 0 || result.removed > 0) {
                    this.queries.updateScanFolderLastScan.run({
                        id: folder.id,
                        lastScanAt: Date.now(),
                    });
                    hasChanges = true;
                }
            } catch {
                /* 静默扫描失败不影响正常使用 */
            }
        }
        if (hasChanges) {
            this.broadcastLibraryChanged();
        }
    }
}

const localMusic = new LocalMusicManager();
export default localMusic;
