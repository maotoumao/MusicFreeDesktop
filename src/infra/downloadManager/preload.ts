/**
 * downloadManager — Preload 层
 *
 * 职责：纯桥接，通过 contextBridge 暴露下载任务管理接口。
 *
 * 暴露名称：'@infra/download-manager'
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';
import type {
    IAddDownloadParams,
    IDownloadProgress,
    IDownloadTaskEvent,
} from '@appTypes/infra/downloadManager';
import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';

const mod = {
    addTask: (params: IAddDownloadParams) => ipcRenderer.invoke(IPC.ADD_TASK, params),

    addTasksBatch: (params: {
        musicItems: Array<IMusic.IMusicItem | IMusicItemSlim>;
        quality?: IMusic.IQualityKey;
    }) => ipcRenderer.invoke(IPC.ADD_TASKS_BATCH, params),

    pauseTask: (taskId: string) => ipcRenderer.invoke(IPC.PAUSE_TASK, taskId),

    resumeTask: (taskId: string) => ipcRenderer.invoke(IPC.RESUME_TASK, taskId),

    removeTask: (taskId: string) => ipcRenderer.invoke(IPC.REMOVE_TASK, taskId),

    removeDownload: (platform: string, musicId: string, deleteFile?: boolean) =>
        ipcRenderer.invoke(IPC.REMOVE_DOWNLOAD, platform, musicId, deleteFile),

    retryTask: (taskId: string) => ipcRenderer.invoke(IPC.RETRY_TASK, taskId),

    pauseAll: () => ipcRenderer.invoke(IPC.PAUSE_ALL),

    resumeAll: () => ipcRenderer.invoke(IPC.RESUME_ALL),

    getTasks: (page: number, pageSize: number) => ipcRenderer.invoke(IPC.GET_TASKS, page, pageSize),

    getAllTasks: () => ipcRenderer.invoke(IPC.GET_ALL_TASKS),

    getAllDownloaded: () => ipcRenderer.invoke(IPC.GET_ALL_DOWNLOADED),

    /** H4: 返回 unsubscribe 函数 */
    onProgress: (cb: (data: { tasks: IDownloadProgress[] }) => void): (() => void) => {
        const handler = (_evt: Electron.IpcRendererEvent, data: { tasks: IDownloadProgress[] }) =>
            cb(data);
        ipcRenderer.on(IPC.PROGRESS, handler);
        return () => ipcRenderer.off(IPC.PROGRESS, handler);
    },

    /** H4: 返回 unsubscribe 函数 */
    onTaskEvent: (cb: (event: IDownloadTaskEvent) => void): (() => void) => {
        const handler = (_evt: Electron.IpcRendererEvent, event: IDownloadTaskEvent) => cb(event);
        ipcRenderer.on(IPC.TASK_EVENT, handler);
        return () => ipcRenderer.off(IPC.TASK_EVENT, handler);
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
