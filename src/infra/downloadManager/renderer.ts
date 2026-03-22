/**
 * downloadManager — Renderer 层
 *
 * 职责：
 * - 下载任务列表管理（分页加载）
 * - 实时下载进度追踪（IPC 广播）
 * - 已下载歌曲 O(1) 查询（内存 Map + useSyncExternalStore）
 * - 代理所有下载操作 IPC 调用
 */

import { useSyncExternalStore, useCallback } from 'react';
import EventEmitter from 'eventemitter3';
import { compositeKey } from '@common/mediaKey';
import debounce from '@common/debounce';
import { CONTEXT_BRIDGE_KEY } from './common/constant';
import type {
    IDownloadTask,
    IDownloadProgress,
    IDownloadTaskEvent,
    IAddDownloadParams,
    ActiveDownloadStatus,
} from '@appTypes/infra/downloadManager';
import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';

// ─── Preload Bridge ───

interface IMod {
    addTask(params: IAddDownloadParams): Promise<IDownloadTask>;
    addTasksBatch(params: {
        musicItems: Array<IMusic.IMusicItem | IMusicItemSlim>;
        quality?: IMusic.IQualityKey;
    }): Promise<IDownloadTask[]>;
    pauseTask(taskId: string): Promise<void>;
    resumeTask(taskId: string): Promise<void>;
    removeTask(taskId: string): Promise<void>;
    removeDownload(platform: string, musicId: string, deleteFile?: boolean): Promise<void>;
    retryTask(taskId: string): Promise<void>;
    pauseAll(): Promise<void>;
    resumeAll(): Promise<void>;
    getTasks(page: number, pageSize: number): Promise<{ data: IDownloadTask[]; total: number }>;
    getAllTasks(): Promise<IDownloadTask[]>;
    getAllDownloaded(): Promise<
        Array<{ platform: string; musicId: string; path: string; quality: IMusic.IQualityKey }>
    >;
    onProgress(cb: (data: { tasks: IDownloadProgress[] }) => void): () => void;
    onTaskEvent(cb: (event: IDownloadTaskEvent) => void): () => void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── DownloadManagerRenderer ───

interface IRendererEvents {
    downloadChange: () => void;
    taskListChange: () => void;
    activeTaskChange: () => void;
}

class DownloadManagerRenderer {
    // ─── 代理方法 ───

    addTask = mod.addTask.bind(mod);
    addTasksBatch = mod.addTasksBatch.bind(mod);
    pauseTask = mod.pauseTask.bind(mod);
    resumeTask = mod.resumeTask.bind(mod);
    /** 删除活跃下载任务（pending/downloading/paused/error） */
    removeTask = mod.removeTask.bind(mod);
    /** 删除已完成的下载（本地文件 + 歌单 + mediaMeta） */
    removeDownload = mod.removeDownload.bind(mod);
    retryTask = mod.retryTask.bind(mod);
    pauseAll = mod.pauseAll.bind(mod);
    resumeAll = mod.resumeAll.bind(mod);

    private isSetup = false;

    /** 下载任务列表 */
    private tasks: IDownloadTask[] = [];
    /** 任务总数 */
    private totalCount = 0;

    /** 实时下载进度 */
    private progressMap = new Map<string, IDownloadProgress>();

    /**
     * 已下载歌曲索引 Map<compositeKey, { path, quality }>
     * 供 useMusicDownloaded 使用
     */
    private downloadedMap = new Map<string, { path: string; quality: IMusic.IQualityKey }>();

    /**
     * 活跃下载任务状态索引 Map<compositeKey, { status, taskId }>
     *
     * 仅在 taskEvent（added/status-changed/completed/removed）时更新，
     * 不受高频 progress 广播影响，保证 useMusicDownloadTask 性能。
     */
    private activeTaskMap = new Map<string, { status: ActiveDownloadStatus; taskId: string }>();
    private activeTaskVersion = 0;

    private events = new EventEmitter<IRendererEvents>();

    private taskListVersion = 0;

    /** IPC 事件取消订阅函数 */
    private unsubProgress: (() => void) | null = null;
    private unsubTaskEvent: (() => void) | null = null;

    /** 防抖刷新任务列表（批量下载时避免高频 IPC） */
    private debouncedRefresh = debounce(async () => {
        try {
            const tasks = await mod.getAllTasks();
            this.tasks = tasks;
            this.totalCount = tasks.length;
            this.taskListVersion++;
            this.events.emit('taskListChange');
        } catch (e) {
            console.error('[downloadManager] refresh failed:', e);
        }
    }, 300);

    async setup(): Promise<void> {
        if (this.isSetup) return;

        // 加载初始任务列表
        const tasks = await mod.getAllTasks();
        this.tasks = tasks;
        this.totalCount = tasks.length;

        // 从初始任务列表构建 activeTaskMap
        for (const task of tasks) {
            if (task.status !== 'completed') {
                const key = compositeKey(task.platform, task.musicId);
                this.activeTaskMap.set(key, {
                    status: task.status as ActiveDownloadStatus,
                    taskId: task.id,
                });
            }
        }

        // C1: 从 mediaMeta 构建 downloadedMap（已完成下载不再存于 download_tasks）
        const downloaded = await mod.getAllDownloaded();
        for (const item of downloaded) {
            const key = compositeKey(item.platform, item.musicId);
            this.downloadedMap.set(key, {
                path: item.path,
                quality: item.quality,
            });
        }

        // H4: 监听进度广播（保存 unsubscribe）
        this.unsubProgress = mod.onProgress(({ tasks }) => {
            for (const p of tasks) {
                this.progressMap.set(p.id, p);
            }
            this.taskListVersion++;
            this.events.emit('taskListChange');
        });

        // H4: 监听任务事件（保存 unsubscribe）
        this.unsubTaskEvent = mod.onTaskEvent((event) => {
            const key = compositeKey(event.task.platform, event.task.musicId);

            // ── 更新 activeTaskMap（独立于 progress，保证 useMusicDownloadTask 性能）──
            if (event.type === 'completed' || event.type === 'removed') {
                this.activeTaskMap.delete(key);
            } else {
                // completed 已在上方分支处理，此处 status 不会是 completed
                this.activeTaskMap.set(key, {
                    status: event.task.status as ActiveDownloadStatus,
                    taskId: event.task.id,
                });
            }
            this.activeTaskVersion++;
            this.events.emit('activeTaskChange');

            // ── 更新 downloadedMap ──
            if (event.type === 'completed' && event.task.filePath) {
                this.downloadedMap.set(key, {
                    path: event.task.filePath,
                    quality: event.task.quality,
                });
                this.events.emit('downloadChange');
            }

            if (event.type === 'removed') {
                if (this.downloadedMap.has(key)) {
                    this.downloadedMap.delete(key);
                    this.events.emit('downloadChange');
                }
            }

            // 清理已完成/已删除任务的进度缓存
            if (event.type === 'completed' || event.type === 'removed') {
                this.progressMap.delete(event.task.id);
            }

            // 刷新任务列表（防抖）
            this.debouncedRefresh();
        });

        this.isSetup = true;
    }

    // ─── 任务列表查询 ───

    getTasks(): IDownloadTask[] {
        return this.tasks;
    }

    getTotalCount(): number {
        return this.totalCount;
    }

    getProgress(taskId: string): IDownloadProgress | undefined {
        return this.progressMap.get(taskId);
    }

    // ─── 已下载状态查询（O(1)） ───

    isDownloaded(item: {
        platform: string;
        id: string;
    }): { path: string; quality: IMusic.IQualityKey } | null {
        return this.downloadedMap.get(compositeKey(item.platform, String(item.id))) ?? null;
    }

    /** 通过 compositeKey 查询下载状态（稳定引用，供 useSyncExternalStore 使用） */
    getDownloadedByKey(key: string): { path: string; quality: IMusic.IQualityKey } | null {
        return this.downloadedMap.get(key) ?? null;
    }

    // ─── 订阅 ───

    subscribeDownloadChange = (cb: () => void): (() => void) => {
        this.events.on('downloadChange', cb);
        return () => this.events.off('downloadChange', cb);
    };

    subscribeTaskListChange = (cb: () => void): (() => void) => {
        this.events.on('taskListChange', cb);
        return () => this.events.off('taskListChange', cb);
    };

    getTaskListSnapshot = (): number => {
        return this.taskListVersion;
    };

    subscribeActiveTaskChange = (cb: () => void): (() => void) => {
        this.events.on('activeTaskChange', cb);
        return () => this.events.off('activeTaskChange', cb);
    };

    /** 通过 compositeKey 查询活跃任务状态（O(1)） */
    getActiveTaskStatus(key: string): ActiveDownloadStatus | null {
        return this.activeTaskMap.get(key)?.status ?? null;
    }

    /** 通过 musicItem 重试失败的下载任务 */
    async retryByMusicItem(item: { platform: string; id: string }): Promise<void> {
        const key = compositeKey(item.platform, String(item.id));
        const entry = this.activeTaskMap.get(key);
        if (entry?.status === 'error') {
            await mod.retryTask(entry.taskId);
        }
    }

    dispose(): void {
        this.unsubProgress?.();
        this.unsubProgress = null;
        this.unsubTaskEvent?.();
        this.unsubTaskEvent = null;
        this.events.removeAllListeners();
        this.activeTaskMap.clear();
        this.downloadedMap.clear();
        this.progressMap.clear();
        this.tasks = [];
        this.totalCount = 0;
        this.isSetup = false;
    }
}

const downloadManager = new DownloadManagerRenderer();
export default downloadManager;

// ═══════════════════════════════════════════════════════
// React Hooks
// ═══════════════════════════════════════════════════════

/**
 * 查询歌曲是否已下载 — 同步 O(1)，仅在下载状态变化时触发 re-render。
 *
 * 性能保证：
 * - 下载进度变化（onProgress）仅触发 taskListChange，不会触发此 hook。
 * - 仅 completed/removed 事件触发 downloadChange。
 * - 当 downloadChange 触发时，所有订阅者的 getSnapshot 被调用（O(1) Map 查找）。
 *   未变化的 key 返回同一引用 → Object.is 判定相同 → 不 re-render。
 */
export function useMusicDownloaded(
    musicItem: { platform: string; id: string } | null | undefined,
): { path: string; quality: IMusic.IQualityKey } | null {
    const key = musicItem ? compositeKey(musicItem.platform, String(musicItem.id)) : null;

    const getSnapshot = useCallback(
        () => (key ? downloadManager.getDownloadedByKey(key) : null),
        [key],
    );

    return useSyncExternalStore(downloadManager.subscribeDownloadChange, getSnapshot);
}

/**
 * 获取下载任务列表 — 任务列表变化时触发 re-render。
 */
export function useDownloadTasks(): IDownloadTask[] {
    useSyncExternalStore(
        downloadManager.subscribeTaskListChange,
        downloadManager.getTaskListSnapshot,
    );
    return downloadManager.getTasks();
}

/**
 * 查询歌曲的活跃下载任务状态 — O(1)，仅在任务事件时触发 re-render。
 *
 * 性能保证：
 * - 独立于 onProgress 广播（不受高频进度事件影响）。
 * - 仅 taskEvent（added/status-changed/completed/removed）触发 activeTaskChange。
 * - Map O(1) 查找 + Object.is 判定：状态未变的按钮不会 re-render。
 *
 * @returns 活跃任务的 ActiveDownloadStatus（pending/downloading/paused/error），无任务时返回 null。
 */
export function useMusicDownloadTask(
    musicItem: { platform: string; id: string } | null | undefined,
): ActiveDownloadStatus | null {
    const key = musicItem ? compositeKey(musicItem.platform, String(musicItem.id)) : null;

    const getSnapshot = useCallback(
        () => (key ? downloadManager.getActiveTaskStatus(key) : null),
        [key],
    );

    return useSyncExternalStore(downloadManager.subscribeActiveTaskChange, getSnapshot);
}

/**
 * 获取指定任务的下载进度。
 */
export function useDownloadProgress(taskId: string): IDownloadProgress | undefined {
    useSyncExternalStore(
        downloadManager.subscribeTaskListChange,
        downloadManager.getTaskListSnapshot,
    );
    return downloadManager.getProgress(taskId);
}
