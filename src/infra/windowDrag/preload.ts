/**
 * windowDrag — Preload 层
 *
 * 职责:
 *  仅在 macOS/Linux 上使用——渲染进程通过 IPC 通知主进程拖拽的起止。
 *  Win32 平台完全由 main 层 hookWindowMessage 处理，preload 层的
 *  startDrag/stopDrag 不会被调用。
 *
 * 暴露名称: '@infra/window-drag'
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { IPoint } from '@appTypes/infra/windowDrag';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    /** 通知主进程开始拖拽，传入鼠标相对窗口的初始偏移 */
    startDrag: (offset: IPoint) => ipcRenderer.send(IPC.START_DRAG, offset),

    /** 通知主进程停止拖拽 */
    stopDrag: () => ipcRenderer.send(IPC.STOP_DRAG),
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
