/**
 * shortCut — Preload 层
 *
 * 职责:
 *  1. 通过 contextBridge 暴露全局快捷键状态查询接口
 *  2. 监听主进程推送的全局快捷键注册状态变更
 *
 * 暴露名称: '@infra/short-cut'
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { IGlobalShortCutRegistration } from '@appTypes/infra/shortCut';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    getGlobalShortCutStatus: (): Promise<IGlobalShortCutRegistration[]> =>
        ipcRenderer.invoke(IPC.GET_STATUS),

    onGlobalShortCutStatusChanged: (
        callback: (registrations: IGlobalShortCutRegistration[]) => void,
    ): (() => void) => {
        const handler = (_event: unknown, registrations: IGlobalShortCutRegistration[]) => {
            callback(registrations);
        };
        ipcRenderer.on(IPC.STATUS_CHANGED, handler);
        return () => {
            ipcRenderer.removeListener(IPC.STATUS_CHANGED, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
