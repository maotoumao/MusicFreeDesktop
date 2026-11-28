/**
 * appConfig — Preload 层
 *
 * 职责：
 * - 通过 contextBridge 暴露配置读写接口
 * - 监听主进程推送的配置变更事件
 *
 * 暴露名称：'@infra/app-config'
 */
import type { IAppConfig } from '@appTypes/infra/appConfig';
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    syncConfig: () => ipcRenderer.invoke(IPC.SYNC_APP_CONFIG),

    setConfig: (config: IAppConfig) => ipcRenderer.send(IPC.SET_APP_CONFIG, config),

    reset: () => ipcRenderer.send(IPC.RESET),

    onConfigUpdate: (callback: (patch: IAppConfig, source: string) => void): (() => void) => {
        const handler = (_event: unknown, patch: IAppConfig, source: string) => {
            callback(patch, source);
        };
        ipcRenderer.on(IPC.UPDATE_APP_CONFIG, handler);
        return () => {
            ipcRenderer.removeListener(IPC.UPDATE_APP_CONFIG, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
