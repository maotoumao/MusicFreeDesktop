/**
 * globalContext — Preload 层
 *
 * 职责：
 * - 同步读取主进程的全局上下文并注入 globalThis
 * - 通过 contextBridge 暴露给渲染进程
 *
 * 暴露名称：'globalContext'
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

if (!globalThis.globalContext) {
    globalThis.globalContext = ipcRenderer.sendSync(IPC.GET_GLOBAL_DATA);
}

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, globalThis.globalContext);
