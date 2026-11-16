/**
 * audioFingerprint — Preload 层
 *
 * 职责：纯桥接，通过 contextBridge 暴露指纹计算与缓存管理接口。
 *
 * 暴露名称：'@infra/audio-fingerprint'
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

type CalcResult =
    | { status: 'success'; fingerprint: number[]; duration: number; cached: boolean }
    | { status: 'error'; message: string };

const mod = {
    checkBinary: (): Promise<{ ok: boolean; path: string; error?: string }> =>
        ipcRenderer.invoke(IPC.CHECK_BINARY),

    calculateFingerprint: (filePath: string): Promise<CalcResult> =>
        ipcRenderer.invoke(IPC.CALCULATE, filePath),

    fileHash: (
        filePath: string,
    ): Promise<{ status: 'success'; hash: string } | { status: 'error'; message: string }> =>
        ipcRenderer.invoke(IPC.FILE_HASH, filePath),

    cacheInfo: (): Promise<{
        path: string;
        sizeBytes: number;
        exists: boolean;
        count: number;
        marksSizeBytes: number;
    }> => ipcRenderer.invoke(IPC.CACHE_INFO),

    clearCache: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.CLEAR_CACHE),

    pruneCache: (keepPaths: string[]): Promise<{ removed: number }> =>
        ipcRenderer.invoke(IPC.PRUNE_CACHE, keepPaths),

    loadMarks: (): Promise<string[]> => ipcRenderer.invoke(IPC.MARKS_LOAD),

    saveMarks: (marks: string[]): Promise<{ ok: boolean }> =>
        ipcRenderer.invoke(IPC.MARKS_SAVE, marks),
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
