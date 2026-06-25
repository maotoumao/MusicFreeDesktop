/**
 * backup — Preload 层
 *
 * 职责：纯桥接，通过 contextBridge 暴露备份与恢复接口。
 *
 * 暴露名称：'@infra/backup'
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { RestoreMode, IBackupResult, IBackupProgress } from '@appTypes/infra/backup';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    backupToFile: (filePath: string): Promise<IBackupResult> =>
        ipcRenderer.invoke(IPC.BACKUP_TO_FILE, filePath),

    restoreFromFile: (filePath: string, mode: RestoreMode): Promise<IBackupResult> =>
        ipcRenderer.invoke(IPC.RESTORE_FROM_FILE, filePath, mode),

    backupToWebDAV: (): Promise<IBackupResult> => ipcRenderer.invoke(IPC.BACKUP_TO_WEBDAV),

    restoreFromWebDAV: (mode: RestoreMode): Promise<IBackupResult> =>
        ipcRenderer.invoke(IPC.RESTORE_FROM_WEBDAV, mode),

    testWebDAV: (): Promise<IBackupResult> => ipcRenderer.invoke(IPC.TEST_WEBDAV),

    onProgress: (cb: (progress: IBackupProgress) => void): (() => void) => {
        const handler = (_ipcEvt: unknown, progress: IBackupProgress) => cb(progress);
        ipcRenderer.on(IPC.PROGRESS, handler);
        return () => {
            ipcRenderer.removeListener(IPC.PROGRESS, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
