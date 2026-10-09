/**
 * mediaMeta — Preload 层
 *
 * 职责:
 *  1. 通过 contextBridge 暴露 media meta 读写接口
 *  2. 监听主进程推送的 meta 变更事件
 *
 * 暴露名称: '@infra/media-meta'
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { MediaMetaPatch, IMediaMetaChangeEvent } from '@appTypes/infra/mediaMeta';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    getMeta: (platform: string, musicId: string) =>
        ipcRenderer.invoke(IPC.GET_META, platform, musicId),

    batchGetMeta: (keys: Array<{ platform: string; musicId: string }>) =>
        ipcRenderer.invoke(IPC.BATCH_GET_META, keys),

    setMeta: (platform: string, musicId: string, patch: MediaMetaPatch) =>
        ipcRenderer.invoke(IPC.SET_META, platform, musicId, patch),

    deleteMeta: (platform: string, musicId: string) =>
        ipcRenderer.invoke(IPC.DELETE_META, platform, musicId),

    queryByField: (field: string) => ipcRenderer.invoke(IPC.QUERY_BY_FIELD, field),

    onMetaChanged: (cb: (event: IMediaMetaChangeEvent) => void): (() => void) => {
        const handler = (_evt: Electron.IpcRendererEvent, event: IMediaMetaChangeEvent) =>
            cb(event);
        ipcRenderer.on(IPC.META_CHANGED, handler);
        return () => {
            ipcRenderer.removeListener(IPC.META_CHANGED, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
