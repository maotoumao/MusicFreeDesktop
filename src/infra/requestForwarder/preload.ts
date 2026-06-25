/**
 * requestForwarder — Preload 层
 *
 * 向渲染进程暴露代理服务器端口查询和端口变更监听接口。
 * 主窗口和辅助窗口共用此 preload。
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    /** 查询当前代理服务器端口 */
    getPort: (): Promise<number | null> => ipcRenderer.invoke(IPC.GET_PORT),

    /** 监听端口变更（worker 重启后端口可能改变） */
    onPortChanged: (callback: (port: number | null) => void): (() => void) => {
        const handler = (_event: unknown, port: number | null) => {
            callback(port);
        };
        ipcRenderer.on(IPC.PORT_CHANGED, handler);
        return () => {
            ipcRenderer.removeListener(IPC.PORT_CHANGED, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
