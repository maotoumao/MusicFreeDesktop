/**
 * pluginManager — Renderer 层
 *
 * 提供插件管理的渲染进程 API：
 * - 双阶段初始化：先用 preload 缓存显示首帧，再异步加载最新数据
 * - jotai 状态管理：见 store.ts（pluginsAtom、pluginMetaAtom）
 * - callPluginMethod：统一方法调用
 * - adapters.getMediaSource：带音质回退的获取音源
 * - React Hooks：见 hooks.ts（usePlugins、usePluginMeta 等）
 */

import type {
    ICallPluginMethodParams,
    IGetMediaSourceParams,
    IGetMediaSourceResult,
    IPluginMetaAll,
} from '@appTypes/infra/pluginManager';
import { CONTEXT_BRIDGE_KEY } from '../common/constant';
import { sortByPluginOrder } from '../common/sortByOrder';
import { store, pluginsAtom, pluginMetaAtom } from './store';

// ─── Preload 接口类型 ───

interface IMod {
    callPluginMethod(params: ICallPluginMethodParams): Promise<any>;
    installPlugin(urlOrPath: string): Promise<{ success: boolean; message?: string }>;
    uninstallPlugin(hash: string): Promise<{ success: boolean; message?: string }>;
    updatePlugin(hash: string): Promise<{ success: boolean; message?: string }>;
    updateAllPlugins(): Promise<{ updated: number; failed: number }>;
    getAllPlugins(): Promise<IPlugin.IPluginDelegate[]>;
    setPluginMeta(hash: string, meta: Partial<IPlugin.IPluginMeta>): Promise<void>;
    batchSetPluginMeta(
        updates: Array<{ hash: string; meta: Partial<IPlugin.IPluginMeta> }>,
    ): Promise<void>;
    getAllPluginMeta(): Promise<IPluginMetaAll>;
    getCachedPlugins(): IPlugin.IPluginDelegate[] | null;
    getLyric(musicItem: IMusic.IMusicItem): Promise<ILyric.ILyricSource | null>;
    getMediaSource(
        params: IGetMediaSourceParams & { hash: string },
    ): Promise<IGetMediaSourceResult | null>;
    onPluginListChanged(callback: (plugins: IPlugin.IPluginDelegate[]) => void): () => void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── 内部状态 ───

/** 初始化完成标志 */
let isInitialized = false;

/** 插件就绪 Promise（异步数据加载完成后 resolve） */
let readyResolve: (() => void) | null = null;
const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
});

// ─── 初始化 ───

/**
 * 双阶段初始化。
 * Phase 1: 从 preload 缓存同步加载首帧数据。
 * Phase 2: 异步获取最新数据并更新状态。
 */
async function setup(): Promise<void> {
    if (isInitialized) return;
    isInitialized = true;

    // Phase 1: 缓存首帧
    const cached = mod.getCachedPlugins();
    if (cached) {
        store.set(pluginsAtom, cached);
    }

    // 注册监听
    mod.onPluginListChanged((plugins) => {
        store.set(pluginsAtom, plugins);
    });

    // Phase 2: 异步获取最新数据
    try {
        const [plugins, meta] = await Promise.all([mod.getAllPlugins(), mod.getAllPluginMeta()]);

        store.set(pluginsAtom, plugins);
        store.set(pluginMetaAtom, meta);
    } catch (err) {
        console.error('[PluginManager Renderer] Failed to load initial data:', err);
    }

    readyResolve?.();
}

// ─── 核心 API ───

/** 等待插件数据就绪 */
function whenReady(): Promise<void> {
    return readyPromise;
}

/** 调用插件方法 */
async function callPluginMethod<
    T extends keyof IPlugin.IPluginInstanceMethods = keyof IPlugin.IPluginInstanceMethods,
>(
    params: ICallPluginMethodParams<T>,
): Promise<Awaited<ReturnType<IPlugin.IPluginInstanceMethods[T]>>> {
    return mod.callPluginMethod(params);
}

/** 安装插件 */
async function installPlugin(urlOrPath: string): Promise<{ success: boolean; message?: string }> {
    return mod.installPlugin(urlOrPath);
}

/** 卸载插件 */
async function uninstallPlugin(hash: string): Promise<{ success: boolean; message?: string }> {
    return mod.uninstallPlugin(hash);
}

/** 更新插件 */
async function updatePlugin(hash: string): Promise<{ success: boolean; message?: string }> {
    return mod.updatePlugin(hash);
}

/** 批量更新全部插件 */
async function updateAllPlugins(): Promise<{ updated: number; failed: number }> {
    return mod.updateAllPlugins();
}

/** 设置插件 meta（排序、用户变量等） */
async function setPluginMeta(hash: string, meta: Partial<IPlugin.IPluginMeta>): Promise<void> {
    await mod.setPluginMeta(hash, meta);

    // 本地更新 meta atom
    const currentMeta = store.get(pluginMetaAtom);
    store.set(pluginMetaAtom, {
        ...currentMeta,
        [hash]: { ...currentMeta[hash], ...meta },
    });
}

/**
 * 批量设置插件 meta（单次 IPC + 单次落盘）。
 * 先同步更新本地 atom（确保 UI 即时响应），再异步持久化到磁盘。
 * 如果 IPC 失败则回滚 atom 到之前的状态。
 */
async function batchSetPluginMeta(
    updates: Array<{ hash: string; meta: Partial<IPlugin.IPluginMeta> }>,
): Promise<void> {
    // 保存旧值以备回滚
    const previousMeta = store.get(pluginMetaAtom);

    // 先同步更新本地 atom
    const newMeta = { ...previousMeta };
    for (const { hash, meta } of updates) {
        newMeta[hash] = { ...newMeta[hash], ...meta };
    }
    store.set(pluginMetaAtom, newMeta);

    // 再异步持久化
    try {
        await mod.batchSetPluginMeta(updates);
    } catch (err) {
        // IPC 失败则回滚
        console.error('[PluginManager Renderer] batchSetPluginMeta failed, rolling back:', err);
        store.set(pluginMetaAtom, previousMeta);
    }
}

/** 获取当前插件列表（快照） */
function getPlugins(): IPlugin.IPluginDelegate[] {
    return store.get(pluginsAtom);
}

/** 获取当前插件 meta（快照） */
function getPluginMeta(): IPluginMetaAll {
    return store.get(pluginMetaAtom);
}

/** 通过 hash 获取单个插件 */
function getPluginByHash(hash: string): IPlugin.IPluginDelegate | undefined {
    return store.get(pluginsAtom).find((p) => p.hash === hash);
}

/** 通过 platform 获取单个插件 */
function getPluginByPlatform(platform: string): IPlugin.IPluginDelegate | undefined {
    return store.get(pluginsAtom).find((p) => p.platform === platform);
}

/**
 * 获取支持指定方法的插件列表。
 * @param enabledOnly 仅返回已启用的插件（默认 true）
 */
function getSupportedPlugin(
    featureMethod: keyof IPlugin.IPluginInstanceMethods,
    enabledOnly = true,
): IPlugin.IPluginDelegate[] {
    const meta = enabledOnly ? store.get(pluginMetaAtom) : null;
    return store
        .get(pluginsAtom)
        .filter(
            (p) =>
                p.supportedMethod.includes(featureMethod) &&
                (!meta || meta[p.hash]?.enabled !== false),
        );
}

/**
 * 获取支持指定方法的插件列表（按 meta.order 排序）。
 * @param enabledOnly 仅返回已启用的插件（默认 true）
 */
function getSortedSupportedPlugin(
    featureMethod: keyof IPlugin.IPluginInstanceMethods,
    enabledOnly = true,
): IPlugin.IPluginDelegate[] {
    const meta = store.get(pluginMetaAtom);
    return sortByPluginOrder(
        store
            .get(pluginsAtom)
            .filter(
                (p) =>
                    p.supportedMethod.includes(featureMethod) &&
                    (!enabledOnly || meta[p.hash]?.enabled !== false),
            ),
        meta,
    );
}

/**
 * 获取支持搜索功能的插件列表（可选按搜索类型过滤）。
 * @param enabledOnly 仅返回已启用的插件（默认 true）
 */
function getSearchablePlugins(
    supportedSearchType?: IMedia.SupportMediaType,
    enabledOnly = true,
): IPlugin.IPluginDelegate[] {
    return getSupportedPlugin('search', enabledOnly).filter((p) =>
        supportedSearchType && p.supportedSearchType
            ? p.supportedSearchType.includes(supportedSearchType)
            : true,
    );
}

/**
 * 获取支持搜索功能的已排序插件列表。
 * @param enabledOnly 仅返回已启用的插件（默认 true）
 */
function getSortedSearchablePlugins(
    supportedSearchType?: IMedia.SupportMediaType,
    enabledOnly = true,
): IPlugin.IPluginDelegate[] {
    return getSortedSupportedPlugin('search', enabledOnly).filter((p) =>
        supportedSearchType && p.supportedSearchType
            ? p.supportedSearchType.includes(supportedSearchType)
            : true,
    );
}

/** 判断指定 platform 的插件是否支持某个方法 */
function isSupportFeatureMethod(
    platform: string,
    featureMethod: keyof IPlugin.IPluginInstanceMethods,
): boolean {
    if (!platform) return false;
    return (
        store
            .get(pluginsAtom)
            .find((p) => p.platform === platform)
            ?.supportedMethod?.includes(featureMethod) ?? false
    );
}

/** 获取插件的 primaryKey 定义 */
function getPluginPrimaryKey(pluginItem: { platform?: string }): string[] {
    return store.get(pluginsAtom).find((p) => p.platform === pluginItem.platform)?.primaryKey ?? [];
}

// ─── Adapters ───

/** 适配器命名空间，封装需要额外业务逻辑的方法 */
const adapters = {
    /**
     * 获取音源（带音质回退和重试）。
     * 实际处理在主进程（直接调用插件，无多次 IPC 开销），通过单次 IPC 调用。
     *
     * @example
     * ```ts
     * const result = await pluginManager.adapters.getMediaSource({
     *     hash,
     *     musicItem,
     *     quality: 'high',
     *     qualityOrder: ['high', 'standard', 'low'],
     *     qualityFallbackOrder: 'lower',
     * });
     * ```
     */
    async getMediaSource(
        params: IGetMediaSourceParams & { hash: string },
    ): Promise<IGetMediaSourceResult | null> {
        return mod.getMediaSource(params);
    },

    /**
     * 获取歌词（含多步回退：本地文件 → 插件 → lrcUrl）。
     * 实际处理在主进程（需要 fs 访问），通过 IPC 调用。
     *
     * @example
     * ```ts
     * const lyric = await pluginManager.adapters.getLyric(musicItem);
     * ```
     */
    async getLyric(musicItem: IMusic.IMusicItem): Promise<ILyric.ILyricSource | null> {
        return mod.getLyric(musicItem);
    },
};

// ─── 导出 ───

const pluginManager = {
    setup,
    whenReady,
    callPluginMethod,
    installPlugin,
    uninstallPlugin,
    updatePlugin,
    updateAllPlugins,
    setPluginMeta,
    batchSetPluginMeta,
    getPlugins,
    getPluginMeta,
    getPluginByHash,
    getPluginByPlatform,
    getSupportedPlugin,
    getSortedSupportedPlugin,
    getSearchablePlugins,
    getSortedSearchablePlugins,
    isSupportFeatureMethod,
    getPluginPrimaryKey,
    adapters,
};

export default pluginManager;
