/**
 * downloadManager — 主进程层
 *
 * 职责：
 * - 下载任务的完整生命周期管理（创建、暂停、恢复、重试、删除）
 * - 并发控制（p-queue）+ 进度节流广播
 * - DB 持久化 + 启动恢复未完成任务
 * - IPC 注册
 */
import { ipcMain } from 'electron';
import PQueue from 'p-queue';
import { nanoid } from 'nanoid';
import path from 'path';
import fsp from 'fs/promises';
import type Database from 'better-sqlite3';
import throttle, { type IThrottledFunction } from '@common/throttle';
import { QUALITY_KEYS, INTERNAL_SLIM_KEY } from '@common/constant';
import sanitizeFileName from '@common/sanitizeFileName';
import { safeParse, safeStringify } from '@common/safeSerialize';
import i18n from '@infra/i18n/main';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IDatabaseProvider } from '@appTypes/infra/database';
import type { IAppConfigReader } from '@appTypes/infra/appConfig';
import type {
    IDownloadTask,
    IDownloadTaskRow,
    IDownloadProgress,
    DownloadStatus,
    IPluginManagerForDownload,
    IDownloadedSheetProvider,
    IAddDownloadParams,
} from '@appTypes/infra/downloadManager';
import type { IMusicItemSlim, IMusicItemProvider } from '@appTypes/infra/musicSheet';
import type { IMediaMetaProvider } from '@appTypes/infra/mediaMeta';
import { IPC } from '../common/constant';
import { DownloadTask } from './downloadTask';

/** DB 行 snake_case → 业务对象 camelCase */
function rowToTask(row: IDownloadTaskRow): IDownloadTask {
    return {
        id: row.id,
        platform: row.platform,
        musicId: row.music_id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        quality: row.quality as IMusic.IQualityKey,
        status: row.status as DownloadStatus,
        filePath: row.file_path,
        tempPath: row.temp_path,
        totalBytes: row.total_bytes,
        downloadedBytes: row.downloaded_bytes,
        mediaSource: row.media_source,
        musicItemRaw: row.music_item_raw,
        error: row.error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

interface IQueries {
    insertTask: Database.Statement;
    updateStatus: Database.Statement;
    getTaskById: Database.Statement;
    getTasksPaginated: Database.Statement;
    getAllTasksUnpaginated: Database.Statement;
    getTaskCount: Database.Statement;
    deleteTask: Database.Statement;
    findExistingActive: Database.Statement;
    recoverTasks: Database.Statement;
    getPausedTasks: Database.Statement;
    getPendingTaskIds: Database.Statement;
}

class DownloadManager {
    private isSetup = false;
    private disposed = false;
    private queue!: PQueue;
    private windowManager!: IWindowManager;
    private appConfig!: IAppConfigReader;
    private db!: IDatabaseProvider;
    private pluginManager!: IPluginManagerForDownload;
    private mediaMeta!: IMediaMetaProvider;
    private downloadedSheet!: IDownloadedSheetProvider;
    private musicItemProvider!: IMusicItemProvider;

    /** 活跃的下载任务（仅 downloading 状态） */
    private activeTasks = new Map<string, DownloadTask>();
    /** 任务世代号（每次 pause/remove 递增，用于拦截过时的 p-queue 回调） */
    private taskGeneration = new Map<string, number>();
    /** 下载进度缓存（用于节流广播） */
    private progressCache = new Map<string, IDownloadProgress>();
    /** 预编译 SQL */
    private queries!: IQueries;
    /** 下载完成时的原子事务 */
    private completeTransaction!: Database.Transaction;

    /** 节流广播进度（200ms） */
    private broadcastProgress: IThrottledFunction<() => void> = throttle(() => {
        if (this.disposed) return;
        const tasks = Array.from(this.progressCache.values());
        if (tasks.length > 0) {
            this.windowManager.broadcast(IPC.PROGRESS, { tasks });
            this.progressCache.clear();
        }
    }, 200);

    public setup(deps: {
        db: IDatabaseProvider;
        appConfig: IAppConfigReader;
        windowManager: IWindowManager;
        pluginManager: IPluginManagerForDownload;
        mediaMeta: IMediaMetaProvider;
        downloadedSheet: IDownloadedSheetProvider;
        musicItemProvider: IMusicItemProvider;
    }): void {
        if (this.isSetup) return;

        this.db = deps.db;
        this.appConfig = deps.appConfig;
        this.windowManager = deps.windowManager;
        this.pluginManager = deps.pluginManager;
        this.mediaMeta = deps.mediaMeta;
        this.downloadedSheet = deps.downloadedSheet;
        this.musicItemProvider = deps.musicItemProvider;

        // 初始化预编译 SQL
        this.initQueries();

        // 初始化并发队列
        const concurrency = this.appConfig.getConfigByKey('download.concurrency') ?? 5;
        this.queue = new PQueue({ concurrency });

        // 监听配置变更，动态调整并发数
        this.appConfig.onConfigUpdated((patch) => {
            if (
                'download.concurrency' in patch &&
                typeof patch['download.concurrency'] === 'number'
            ) {
                this.queue.concurrency = patch['download.concurrency'];
            }
        });

        // 注册 IPC handlers
        this.registerIpcHandlers();

        // 启动时恢复未完成的任务为 paused 状态
        this.recoverTasks();

        this.isSetup = true;
    }

    public dispose(): void {
        this.disposed = true;
        this.broadcastProgress.cancel();

        // 暂停所有活跃任务
        for (const [, dt] of this.activeTasks) {
            dt.abort();
            dt.task.status = 'paused';
            dt.task.updatedAt = Date.now();
            this.updateTaskStatus(dt.task);
        }
        this.activeTasks.clear();
        this.queue.clear();
    }

    // ─── 初始化 ────────────────────────

    private initQueries(): void {
        const db = this.db.getDatabase();

        this.queries = {
            insertTask: db.prepare(`
                INSERT INTO download_tasks
                    (id, platform, music_id, title, artist, album, quality,
                     status, file_path, temp_path, total_bytes, downloaded_bytes,
                     media_source, music_item_raw, error, created_at, updated_at)
                VALUES
                    (@id, @platform, @musicId, @title, @artist, @album, @quality,
                     @status, @filePath, @tempPath, @totalBytes, @downloadedBytes,
                     @mediaSource, @musicItemRaw, @error, @createdAt, @updatedAt)
            `),

            updateStatus: db.prepare(`
                UPDATE download_tasks SET
                    status = @status,
                    quality = @quality,
                    file_path = @filePath,
                    total_bytes = @totalBytes,
                    downloaded_bytes = @downloadedBytes,
                    media_source = @mediaSource,
                    error = @error,
                    updated_at = @updatedAt
                WHERE id = @id
            `),

            getTaskById: db.prepare('SELECT * FROM download_tasks WHERE id = ?'),

            getTasksPaginated: db.prepare(
                'SELECT * FROM download_tasks ORDER BY created_at DESC LIMIT ? OFFSET ?',
            ),

            getAllTasksUnpaginated: db.prepare(
                'SELECT * FROM download_tasks ORDER BY created_at DESC',
            ),

            getTaskCount: db.prepare('SELECT COUNT(*) AS count FROM download_tasks'),

            deleteTask: db.prepare('DELETE FROM download_tasks WHERE id = ?'),

            findExistingActive: db.prepare(
                `SELECT * FROM download_tasks
                 WHERE platform = ? AND music_id = ?
                   AND status IN ('pending', 'downloading', 'paused', 'error')
                 LIMIT 1`,
            ),

            recoverTasks: db.prepare(
                `UPDATE download_tasks SET status = 'paused', updated_at = ?
                 WHERE status IN ('downloading', 'pending')`,
            ),

            getPausedTasks: db.prepare(
                `SELECT * FROM download_tasks WHERE status = 'paused' ORDER BY created_at ASC`,
            ),

            getPendingTaskIds: db.prepare(`SELECT id FROM download_tasks WHERE status = 'pending'`),
        };

        // H1: 原子事务封装下载完成的多步操作
        this.completeTransaction = db.transaction(
            (task: IDownloadTask, musicItem: IMusic.IMusicItem | null) => {
                // 1. 写入 music_items + __downloaded__ 歌单
                if (musicItem) {
                    this.downloadedSheet.addMusicToDownloaded(musicItem);
                }

                // 2. 写入 mediaMeta（下载路径 + 音质）
                this.mediaMeta.setMeta(task.platform, task.musicId, {
                    downloadData: {
                        path: task.filePath!,
                        quality: task.quality,
                    },
                });

                // 3. 从 download_tasks 删除已完成行（C1: 不保留完成记录）
                this.queries.deleteTask.run(task.id);
            },
        );
    }

    private registerIpcHandlers(): void {
        ipcMain.handle(IPC.ADD_TASK, async (_evt, params: IAddDownloadParams) => {
            return this.addTask(params.musicItem, params.quality);
        });

        ipcMain.handle(
            IPC.ADD_TASKS_BATCH,
            async (
                _evt,
                params: {
                    musicItems: Array<IMusic.IMusicItem | IMusicItemSlim>;
                    quality?: IMusic.IQualityKey;
                },
            ) => {
                return this.addTasksBatch(params.musicItems, params.quality);
            },
        );

        ipcMain.handle(IPC.PAUSE_TASK, (_evt, taskId: string) => {
            this.pauseTask(taskId);
        });

        ipcMain.handle(IPC.RESUME_TASK, (_evt, taskId: string) => {
            this.resumeTask(taskId);
        });

        ipcMain.handle(IPC.REMOVE_TASK, async (_evt, taskId: string) => {
            await this.removeTask(taskId);
        });

        ipcMain.handle(
            IPC.REMOVE_DOWNLOAD,
            async (_evt, platform: string, musicId: string, deleteFile?: boolean) => {
                await this.removeDownload(platform, musicId, deleteFile);
            },
        );

        ipcMain.handle(IPC.RETRY_TASK, (_evt, taskId: string) => {
            this.retryTask(taskId);
        });

        ipcMain.handle(IPC.PAUSE_ALL, () => {
            this.pauseAll();
        });

        ipcMain.handle(IPC.RESUME_ALL, () => {
            this.resumeAll();
        });

        ipcMain.handle(IPC.GET_TASKS, (_evt, page: number, pageSize: number) => {
            return this.getTasks(page, pageSize);
        });

        ipcMain.handle(IPC.GET_ALL_TASKS, () => {
            return this.getAllTasks();
        });

        ipcMain.handle(IPC.GET_ALL_DOWNLOADED, () => {
            return this.mediaMeta.getAllDownloaded();
        });
    }

    // ─── 核心方法 ────────────────────────

    private async addTask(
        musicItem: IMusic.IMusicItem | IMusicItemSlim,
        quality: IMusic.IQualityKey | undefined,
    ): Promise<IDownloadTask> {
        const targetQuality =
            quality ?? this.appConfig.getConfigByKey('download.defaultQuality') ?? 'standard';
        const downloadPath =
            this.appConfig.getConfigByKey('download.path') ??
            globalContext.appPath.defaultDownloadPath;

        const platform = musicItem.platform;
        const musicId = String(musicItem.id);

        // M1: 先检查是否存在活跃（pending/downloading/paused/error）的任务
        const existingActive = this.queries.findExistingActive.get(platform, musicId) as
            | IDownloadTaskRow
            | undefined;
        if (existingActive) return rowToTask(existingActive);

        // C1: 再检查是否已下载（通过 mediaMeta）
        const existingDownload = this.mediaMeta.getDownloadData(platform, musicId);
        if (existingDownload) {
            throw new Error(i18n.t('download.already_downloaded'));
        }

        const fileName = this.buildFileName(musicItem);
        const filePath = path.join(downloadPath, fileName);

        const now = Date.now();
        const id = nanoid();
        const tempPath = `${filePath}.${id}.downloading`;

        const task: IDownloadTask = {
            id,
            platform,
            musicId,
            title: musicItem.title,
            artist: musicItem.artist ?? '',
            album: musicItem.album ?? '',
            quality: targetQuality,
            status: 'pending',
            filePath,
            tempPath,
            totalBytes: 0,
            downloadedBytes: 0,
            mediaSource: null,
            musicItemRaw: safeStringify(musicItem),
            error: null,
            createdAt: now,
            updatedAt: now,
        };

        // 1. 持久化下载任务到 SQLite（musicItem 序列化为 musicItemRaw 列）
        if (!this.persistTask(task)) {
            // UNIQUE 冲突 → 同一首歌已在任务表中，返回已有记录
            const existing = this.queries.findExistingActive.get(platform, musicId) as
                | IDownloadTaskRow
                | undefined;
            if (existing) return rowToTask(existing);
            throw new Error(i18n.t('download.already_in_queue'));
        }

        // 2. 入队
        this.enqueueTask(task);

        // 通知渲染进程
        this.windowManager.broadcast(IPC.TASK_EVENT, { task, type: 'added' });

        return task;
    }

    /**
     * M7: 批量添加下载任务，使用 Promise.allSettled 并发获取媒体源。
     */
    private async addTasksBatch(
        musicItems: Array<IMusic.IMusicItem | IMusicItemSlim>,
        quality?: IMusic.IQualityKey,
    ): Promise<IDownloadTask[]> {
        const results = await Promise.allSettled(
            musicItems.map((item) => this.addTask(item, quality)),
        );
        return results
            .filter((r): r is PromiseFulfilledResult<IDownloadTask> => r.status === 'fulfilled')
            .map((r) => r.value);
    }

    private enqueueTask(task: IDownloadTask): void {
        // 捕获当前世代号，回调执行时比对——若不一致说明中间发生过 pause/remove
        const generation = this.taskGeneration.get(task.id) ?? 0;

        this.queue.add(async () => {
            // 世代号不匹配 → 入队后发生过 pause/remove，跳过执行
            if ((this.taskGeneration.get(task.id) ?? 0) !== generation) return;

            // DB 新鲜度校验：防止快速 pause-resume 导致重复执行
            const freshRow = this.queries.getTaskById.get(task.id) as IDownloadTaskRow | undefined;
            if (!freshRow || freshRow.status !== 'pending') return;

            // 延迟获取媒体源：在任务真正开始执行时才获取，避免 resumeAll 过早批量请求
            let musicItem = safeParse<IMusic.IMusicItem>(task.musicItemRaw ?? '');
            if (musicItem && !task.mediaSource) {
                // slim 对象解析：插件 getMediaSource 可能依赖完整字段，从 DB 查询 raw JSON
                if ((musicItem as any)[INTERNAL_SLIM_KEY]) {
                    const full = this.musicItemProvider.getRawMusicItem(
                        musicItem.platform,
                        String(musicItem.id),
                    );
                    if (full) {
                        musicItem = full;
                        task.musicItemRaw = safeStringify(full);
                    }
                }

                try {
                    const source = await this.pluginManager.getMediaSource(
                        musicItem,
                        task.quality,
                        QUALITY_KEYS,
                        this.appConfig.getConfigByKey('download.whenQualityMissing') ?? 'lower',
                    );

                    if (source?.url) {
                        task.mediaSource = safeStringify(source);
                        // 更新实际音质（插件可能回退到其他音质）
                        if (source.quality && source.quality !== task.quality) {
                            task.quality = source.quality;
                        }
                    }
                } catch {
                    // 获取失败 → mediaSource 仍为 null，走下方兜底
                }
            }

            // 再次检查世代号（异步 getMediaSource 期间可能被 pause/remove）
            if ((this.taskGeneration.get(task.id) ?? 0) !== generation) return;

            // 检查是否在异步间隙中被 dispose
            if (this.disposed) return;

            // mediaSource 仍为空 → 无法下载，直接标记错误
            if (!task.mediaSource) {
                task.status = 'error';
                task.error = i18n.t('download.cannot_get_source');
                task.updatedAt = Date.now();
                this.updateTaskStatus(task);
                this.windowManager.broadcast(IPC.TASK_EVENT, { task, type: 'error' });
                return;
            }

            task.status = 'downloading';
            this.updateTaskStatus(task);
            this.windowManager.broadcast(IPC.TASK_EVENT, {
                task,
                type: 'status-changed',
            });

            const dt = new DownloadTask(task);
            this.activeTasks.set(task.id, dt);

            // 保存原始 filePath（不含扩展名），以便 completeTransaction 失败时恢复
            const baseFilePath = task.filePath;

            await dt.execute(
                // onProgress
                (downloadedBytes, totalBytes, speed) => {
                    this.progressCache.set(task.id, {
                        id: task.id,
                        downloadedBytes,
                        totalBytes,
                        speed,
                    });
                    this.broadcastProgress();
                },
                // onCompleted
                () => {
                    this.activeTasks.delete(task.id);
                    this.progressCache.delete(task.id);

                    // 任务可能在 rename 间隙被 removeTask 删除
                    const freshRow = this.queries.getTaskById.get(task.id);
                    if (!freshRow) return;

                    try {
                        task.status = 'completed';
                        task.updatedAt = Date.now();

                        // H1: 原子事务 — 写入歌单 + mediaMeta + 删除任务行
                        const musicItem = safeParse<IMusic.IMusicItem>(task.musicItemRaw ?? '');
                        this.completeTransaction(task, musicItem);

                        this.windowManager.broadcast(IPC.TASK_EVENT, {
                            task,
                            type: 'completed',
                        });
                    } catch (completeErr: any) {
                        // 清理已 rename 的孤立文件，避免磁盘泄漏
                        if (task.filePath) {
                            fsp.unlink(task.filePath).catch(() => {
                                /* ignore */
                            });
                        }
                        // 恢复原始无扩展名路径，避免 retry 时产生双重扩展名
                        task.filePath = baseFilePath;
                        task.status = 'error';
                        task.error = i18n.t('download.complete_failed', {
                            reason: completeErr.message,
                        });
                        task.updatedAt = Date.now();
                        try {
                            this.updateTaskStatus(task);
                        } catch {
                            // DB 不可恢复，仅广播状态
                        }
                        this.windowManager.broadcast(IPC.TASK_EVENT, {
                            task,
                            type: 'error',
                        });
                    }
                },
                // onError
                (err) => {
                    if (dt.isAborted) return;

                    task.status = 'error';
                    task.error = err.message;
                    task.updatedAt = Date.now();
                    this.activeTasks.delete(task.id);
                    this.progressCache.delete(task.id);
                    this.updateTaskStatus(task);
                    this.windowManager.broadcast(IPC.TASK_EVENT, {
                        task,
                        type: 'error',
                    });
                },
            );
        });
    }

    private pauseTask(taskId: string): void {
        // 检查活跃任务
        const active = this.activeTasks.get(taskId);
        if (active) {
            active.abort();
            active.task.status = 'paused';
            active.task.updatedAt = Date.now();
            this.updateTaskStatus(active.task);
            this.activeTasks.delete(taskId);
            this.windowManager.broadcast(IPC.TASK_EVENT, {
                task: active.task,
                type: 'status-changed',
            });
            return;
        }

        // pending 状态也标记为 paused，递增世代号使对应的 p-queue 回调失效
        const row = this.queries.getTaskById.get(taskId) as IDownloadTaskRow | undefined;
        if (row && row.status === 'pending') {
            this.taskGeneration.set(taskId, (this.taskGeneration.get(taskId) ?? 0) + 1);
            const task = rowToTask(row);
            task.status = 'paused';
            task.updatedAt = Date.now();
            this.updateTaskStatus(task);
            this.windowManager.broadcast(IPC.TASK_EVENT, {
                task,
                type: 'status-changed',
            });
        }
    }

    /**
     * 恢复任务：mediaSource 延迟到 enqueueTask 回调中获取，避免 resumeAll 时密集请求。
     */
    private resumeTask(taskId: string): void {
        const row = this.queries.getTaskById.get(taskId) as IDownloadTaskRow | undefined;
        if (!row || row.status !== 'paused') return;

        const task = rowToTask(row);

        // 清空 mediaSource 强制延迟到 enqueueTask 中重新获取
        task.mediaSource = null;
        task.status = 'pending';
        task.error = null;
        task.updatedAt = Date.now();
        this.updateTaskStatus(task);
        this.enqueueTask(task);
        this.windowManager.broadcast(IPC.TASK_EVENT, { task, type: 'status-changed' });
    }

    private retryTask(taskId: string): void {
        const row = this.queries.getTaskById.get(taskId) as IDownloadTaskRow | undefined;
        if (!row || row.status !== 'error') return;

        const task = rowToTask(row);

        // 删除旧临时文件，确保干净重试（新 URL 可能来自不同 CDN）
        if (task.tempPath) {
            fsp.unlink(task.tempPath).catch(() => {
                /* ignore */
            });
        }

        // 清空 mediaSource 强制延迟到 enqueueTask 中重新获取
        task.mediaSource = null;
        task.status = 'pending';
        task.error = null;
        task.downloadedBytes = 0;
        task.totalBytes = 0;
        task.updatedAt = Date.now();
        this.updateTaskStatus(task);
        this.enqueueTask(task);
        this.windowManager.broadcast(IPC.TASK_EVENT, { task, type: 'status-changed' });
    }

    /**
     * 删除活跃下载任务（pending/downloading/paused/error）。
     * - 中止活跃下载 + 删除临时文件 + 从 DB 删除
     */
    private async removeTask(taskId: string): Promise<void> {
        // 先中止活跃下载
        const active = this.activeTasks.get(taskId);
        if (active) {
            active.abort();
            this.activeTasks.delete(taskId);
        }

        // 读取任务信息
        const row = this.queries.getTaskById.get(taskId) as IDownloadTaskRow | undefined;

        // 递增世代号使对应的 p-queue 回调失效
        this.taskGeneration.set(taskId, (this.taskGeneration.get(taskId) ?? 0) + 1);

        // 清理临时文件
        if (row?.temp_path) {
            try {
                await fsp.unlink(row.temp_path);
            } catch {
                // 文件不存在等情况忽略
            }
        }

        // 从 DB 删除任务记录
        this.queries.deleteTask.run(taskId);

        if (row) {
            this.windowManager.broadcast(IPC.TASK_EVENT, {
                task: rowToTask(row),
                type: 'removed',
            });
        }
    }

    /**
     * 删除已完成的下载（歌单 + mediaMeta，可选删除本地文件）。
     * C1: 完成后 download_tasks 中已无记录，操作对象是 mediaMeta + musicSheet。
     * @param deleteFile 是否同时删除本地文件，默认 true
     */
    private async removeDownload(
        platform: string,
        musicId: string,
        deleteFile = true,
    ): Promise<void> {
        // 查询 mediaMeta 获取下载路径
        const downloadData = this.mediaMeta.getDownloadData(platform, musicId);
        if (!downloadData) return;

        // 删除本地文件（可选）
        if (deleteFile) {
            try {
                await fsp.unlink(downloadData.path);
            } catch {
                // ignore
            }
        }

        // 从 __downloaded__ 歌单移除 + 清除 mediaMeta（原子事务）
        const db = this.db.getDatabase();
        db.transaction(() => {
            this.downloadedSheet.removeFromDownloaded(platform, musicId);
            this.mediaMeta.setMeta(platform, musicId, {
                downloadData: null,
            });
        })();

        this.windowManager.broadcast(IPC.TASK_EVENT, {
            task: {
                id: '',
                platform,
                musicId,
                title: '',
                artist: '',
                album: '',
                quality: 'standard' as IMusic.IQualityKey,
                status: 'completed' as DownloadStatus,
                filePath: downloadData.path,
                tempPath: null,
                totalBytes: 0,
                downloadedBytes: 0,
                mediaSource: null,
                musicItemRaw: null,
                error: null,
                createdAt: 0,
                updatedAt: 0,
            },
            type: 'removed',
        });
    }

    /** L5: 使用预编译语句查询 pending 任务 */
    private pauseAll(): void {
        // 快照 keys 再遍历，因为 pauseTask 内部会修改 activeTasks
        for (const taskId of Array.from(this.activeTasks.keys())) {
            this.pauseTask(taskId);
        }
        // 暂停队列中等待的 pending 任务
        const pendingRows = this.queries.getPendingTaskIds.all() as Array<{ id: string }>;
        for (const { id } of pendingRows) {
            this.pauseTask(id);
        }
    }

    private resumeAll(): void {
        const rows = this.queries.getPausedTasks.all() as IDownloadTaskRow[];
        for (const row of rows) {
            this.resumeTask(row.id);
        }
    }

    private getTasks(page: number, pageSize: number): { data: IDownloadTask[]; total: number } {
        const offset = (page - 1) * pageSize;
        const rows = this.queries.getTasksPaginated.all(pageSize, offset) as IDownloadTaskRow[];
        const { count } = this.queries.getTaskCount.get() as { count: number };
        return {
            data: rows.map(rowToTask),
            total: count,
        };
    }

    private getAllTasks(): IDownloadTask[] {
        const rows = this.queries.getAllTasksUnpaginated.all() as IDownloadTaskRow[];
        return rows.map(rowToTask);
    }

    // ─── 辅助 ────────────────────────

    /**
     * 持久化任务到 DB。返回 true 表示成功插入，false 表示 UNIQUE 冲突（重复歌曲）。
     */
    private persistTask(task: IDownloadTask): boolean {
        try {
            this.queries.insertTask.run({
                id: task.id,
                platform: task.platform,
                musicId: task.musicId,
                title: task.title,
                artist: task.artist,
                album: task.album,
                quality: task.quality,
                status: task.status,
                filePath: task.filePath,
                tempPath: task.tempPath,
                totalBytes: task.totalBytes,
                downloadedBytes: task.downloadedBytes,
                mediaSource: task.mediaSource,
                musicItemRaw: task.musicItemRaw,
                error: task.error,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
            });
            return true;
        } catch (err: any) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return false;
            }
            throw err;
        }
    }

    private updateTaskStatus(task: IDownloadTask): void {
        this.queries.updateStatus.run({
            id: task.id,
            status: task.status,
            quality: task.quality,
            filePath: task.filePath,
            totalBytes: task.totalBytes,
            downloadedBytes: task.downloadedBytes,
            mediaSource: task.mediaSource,
            error: task.error,
            updatedAt: task.updatedAt,
        });
    }

    /** 构建文件名（不含扩展名，由 downloadTask 下载完成后根据 Content-Type 推断） */
    private buildFileName(musicItem: IMusic.IMusicItem): string {
        const artist = musicItem.artist || 'Unknown';
        const title = musicItem.title || 'Unknown';
        return sanitizeFileName(`${artist} - ${title}`, 170);
    }

    /** 应用启动时，将所有 downloading/pending 状态恢复为 paused */
    private recoverTasks(): void {
        this.queries.recoverTasks.run(Date.now());
    }
}

const downloadManager = new DownloadManager();
export default downloadManager;
