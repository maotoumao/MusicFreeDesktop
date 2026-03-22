/**
 * localMusic — Preload 层
 *
 * 职责: 纯桥接，无状态。
 *  1. 通过 contextBridge 暴露异步查询 + 扫描操作
 *  2. 转发 LIBRARY_CHANGED / SCAN_PROGRESS 事件
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    // ─── 全量歌曲（异步 IPC） ───
    getAllMusicItems: () => ipcRenderer.invoke(IPC.GET_ALL_MUSIC_ITEMS),

    // ─── 扫描文件夹管理（异步 IPC） ───
    getScanFolders: () => ipcRenderer.invoke(IPC.GET_SCAN_FOLDERS),
    syncScanFolders: (folderPaths: string[]) =>
        ipcRenderer.invoke(IPC.SYNC_SCAN_FOLDERS, folderPaths),

    // ─── 删除 ───
    deleteItems: (musicBases: IMedia.IMediaBase[]): Promise<void> =>
        ipcRenderer.invoke(IPC.DELETE_ITEMS, musicBases),

    // ─── 事件监听 ───
    onLibraryChanged: (cb: () => void): (() => void) => {
        const handler = () => cb();
        ipcRenderer.on(IPC.LIBRARY_CHANGED, handler);
        return () => {
            ipcRenderer.removeListener(IPC.LIBRARY_CHANGED, handler);
        };
    },

    onScanProgress: (cb: (progress: unknown) => void): (() => void) => {
        const handler = (_evt: Electron.IpcRendererEvent, progress: unknown) => cb(progress);
        ipcRenderer.on(IPC.SCAN_PROGRESS, handler);
        return () => {
            ipcRenderer.removeListener(IPC.SCAN_PROGRESS, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
