/**
 * pluginManager — Preload 层
 *
 * 向渲染进程暴露插件管理 API。
 * 在 preload 阶段同步读取 .plugin-cache.json，供首帧渲染使用。
 * 支持多回调的事件监听。
 */

import fs from 'fs';
import path from 'path';
import { contextBridge, ipcRenderer } from 'electron';
import type {
    ICallPluginMethodParams,
    IGetMediaSourceParams,
    IGetMediaSourceResult,
    IPluginCacheData,
    IPluginMetaAll,
} from '@appTypes/infra/pluginManager';
import {
    IPC_CALL_PLUGIN_METHOD,
    IPC_INSTALL_PLUGIN,
    IPC_UNINSTALL_PLUGIN,
    IPC_UPDATE_PLUGIN,
    IPC_UPDATE_ALL_PLUGINS,
    IPC_GET_ALL_PLUGINS,
    IPC_SET_PLUGIN_META,
    IPC_BATCH_SET_PLUGIN_META,
    IPC_GET_ALL_PLUGIN_META,
    IPC_PLUGIN_LIST_CHANGED,
    IPC_GET_LYRIC,
    IPC_GET_MEDIA_SOURCE,
    PLUGIN_CACHE_FILE_NAME,
    CONTEXT_BRIDGE_KEY,
} from './common/constant';

// ─── 同步读取缓存（首帧渲染） ───

function readCacheSync(): IPluginCacheData | null {
    try {
        const userDataPath = globalContext.appPath.userData;
        const cachePath = path.join(userDataPath, PLUGIN_CACHE_FILE_NAME);

        if (fs.existsSync(cachePath)) {
            const raw = fs.readFileSync(cachePath, 'utf-8');
            return JSON.parse(raw);
        }
    } catch {
        // 缓存读取失败不影响启动
    }
    return null;
}

const cachedData = readCacheSync();

// ─── IPC 封装函数 ───

async function callPluginMethod(params: ICallPluginMethodParams): Promise<any> {
    return ipcRenderer.invoke(IPC_CALL_PLUGIN_METHOD, params);
}

async function installPlugin(urlOrPath: string): Promise<{ success: boolean; message?: string }> {
    return ipcRenderer.invoke(IPC_INSTALL_PLUGIN, urlOrPath);
}

async function uninstallPlugin(hash: string): Promise<{ success: boolean; message?: string }> {
    return ipcRenderer.invoke(IPC_UNINSTALL_PLUGIN, hash);
}

async function updatePlugin(hash: string): Promise<{ success: boolean; message?: string }> {
    return ipcRenderer.invoke(IPC_UPDATE_PLUGIN, hash);
}

async function updateAllPlugins(): Promise<{ updated: number; failed: number }> {
    return ipcRenderer.invoke(IPC_UPDATE_ALL_PLUGINS);
}

async function getAllPlugins(): Promise<IPlugin.IPluginDelegate[]> {
    return ipcRenderer.invoke(IPC_GET_ALL_PLUGINS);
}

async function setPluginMeta(hash: string, meta: Partial<IPlugin.IPluginMeta>): Promise<void> {
    return ipcRenderer.invoke(IPC_SET_PLUGIN_META, hash, meta);
}

async function batchSetPluginMeta(
    updates: Array<{ hash: string; meta: Partial<IPlugin.IPluginMeta> }>,
): Promise<void> {
    return ipcRenderer.invoke(IPC_BATCH_SET_PLUGIN_META, updates);
}

async function getAllPluginMeta(): Promise<IPluginMetaAll> {
    return ipcRenderer.invoke(IPC_GET_ALL_PLUGIN_META);
}

function getCachedPlugins(): IPlugin.IPluginDelegate[] | null {
    return cachedData?.plugins ?? null;
}

async function getLyric(musicItem: IMusic.IMusicItem): Promise<ILyric.ILyricSource | null> {
    return ipcRenderer.invoke(IPC_GET_LYRIC, { musicItem });
}

async function getMediaSource(
    params: IGetMediaSourceParams & { hash: string },
): Promise<IGetMediaSourceResult | null> {
    return ipcRenderer.invoke(IPC_GET_MEDIA_SOURCE, params);
}

// ─── 事件监听（支持多回调） ───

type PluginListChangedCallback = (plugins: IPlugin.IPluginDelegate[]) => void;

const listChangedCallbacks = new Set<PluginListChangedCallback>();

ipcRenderer.on(IPC_PLUGIN_LIST_CHANGED, (_event, plugins: IPlugin.IPluginDelegate[]) => {
    for (const cb of listChangedCallbacks) {
        try {
            cb(plugins);
        } catch (err) {
            console.error('[PluginManager Preload] Callback error:', err);
        }
    }
});

function onPluginListChanged(callback: PluginListChangedCallback): () => void {
    listChangedCallbacks.add(callback);
    return () => {
        listChangedCallbacks.delete(callback);
    };
}

// ─── 暴露模块 ───

const mod = {
    callPluginMethod,
    installPlugin,
    uninstallPlugin,
    updatePlugin,
    updateAllPlugins,
    getAllPlugins,
    setPluginMeta,
    batchSetPluginMeta,
    getAllPluginMeta,
    getCachedPlugins,
    getLyric,
    getMediaSource,
    onPluginListChanged,
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
