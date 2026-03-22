/**
 * logger — Preload 层
 *
 * 职责：通过 contextBridge 暴露日志写入接口（单向 IPC）。
 *
 * 暴露名称：'@infra/logger'
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { ILogEntry } from '@appTypes/infra/logger';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    log: (entry: ILogEntry) => ipcRenderer.send(IPC.LOG, entry),
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
