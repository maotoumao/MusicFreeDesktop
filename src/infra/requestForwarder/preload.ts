/**
 * requestForwarder — Preload 层
 *
 * 向渲染进程暴露代理服务器连接信息查询和变更监听接口。
 * 主窗口和辅助窗口共用此 preload。
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IRequestForwarderInfo } from '@appTypes/infra/requestForwarder';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    /** 查询当前代理服务器连接信息（端口 + 令牌），未就绪时为 null */
    getInfo: (): Promise<IRequestForwarderInfo | null> => ipcRenderer.invoke(IPC.GET_INFO),

    /** 监听连接信息变更（worker 重启后端口可能改变，退出期间为 null） */
    onInfoChanged: (callback: (info: IRequestForwarderInfo | null) => void): (() => void) => {
        const handler = (_event: unknown, info: IRequestForwarderInfo | null) => {
            callback(info);
        };
        ipcRenderer.on(IPC.INFO_CHANGED, handler);
        return () => {
            ipcRenderer.removeListener(IPC.INFO_CHANGED, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
