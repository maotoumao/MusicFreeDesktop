/**
 * pluginManager — 主进程层
 *
 * 管理插件的完整生命周期：
 * - 插件加载：从磁盘读取 .js 文件，在沙箱中执行
 * - 插件安装/卸载/更新：支持 URL 和本地路径
 * - 插件方法调用：统一入口 callPluginMethod，含标准化处理
 * - 插件缓存：生成 .plugin-cache.json 供 preload 首帧渲染
 * - 内建插件注册：支持 registerBuiltinPlugin
 *
 * 遵循 infra 模块规范：class 单例 + setup() 幂等初始化。
 */

import fs from 'fs';
import path from 'path';
import { ipcMain } from 'electron';
import { nanoid } from 'nanoid';
import { compare } from 'compare-versions';
import axios from 'axios';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type { ICallPluginMethodParams, IPluginMetaAll } from '@appTypes/infra/pluginManager';
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
    PLUGIN_DIR_NAME,
    PLUGIN_CACHE_FILE_NAME,
    PLUGIN_META_FILE_NAME,
} from '../common/constant';
import {
    computeHash,
    executePluginCode,
    extractPluginDelegate,
    type ISandboxOptions,
} from './pluginSandbox';
import { PluginStorage } from './pluginStorage';
import { methodNormalizers } from './normalizer';
import type { IAppConfigReader } from '@appTypes/infra/appConfig';
import type { IMediaMetaProvider } from '@appTypes/infra/mediaMeta';
import type { IMusicItemProvider } from '@appTypes/infra/musicSheet';
import { getLyricAdapter, type IGetLyricParams } from './getLyricAdapter';
import { getMediaSourceAdapter, type IGetMediaSourceAdapterParams } from './getMediaSourceAdapter';

/** 已加载的插件记录 */
interface ILoadedPlugin {
    /** 插件实例（含方法） */
    instance: IPlugin.IPluginInstance;
    /** 插件代码哈希 */
    hash: string;
    /** 可序列化的代理对象 */
    delegate: IPlugin.IPluginDelegate;
}

class PluginManager {
    private isSetup = false;
    private windowManager: IWindowManager | null = null;
    private pluginStorage: PluginStorage | null = null;
    private appConfigReader: IAppConfigReader | null = null;
    private mediaMeta!: IMediaMetaProvider;
    private musicItemProvider!: IMusicItemProvider;

    /** hash → ILoadedPlugin */
    private plugins = new Map<string, ILoadedPlugin>();

    /** 内建插件注册表：platform → instance */
    private builtinPlugins = new Map<string, IPlugin.IPluginInstance>();

    /** 插件 meta（排序、用户变量） */
    private pluginMeta: IPluginMetaAll = {};

    /** 插件目录路径 */
    private pluginBasePath = '';

    /** 缓存文件路径 */
    private cachePath = '';

    /** meta 文件路径 */
    private metaPath = '';

    /** 异步加载完成的 Promise */
    private pluginsReadyPromise: Promise<void> | null = null;

    /**
     * 初始化模块。
     * setup 同步注册 IPC handler，loadAllPlugins 异步执行。
     */
    public setup(deps: {
        appConfigReader: IAppConfigReader;
        mediaMeta: IMediaMetaProvider;
        musicItemProvider: IMusicItemProvider;
        windowManager?: IWindowManager;
    }): void {
        if (this.isSetup) return;

        this.appConfigReader = deps.appConfigReader;
        this.mediaMeta = deps.mediaMeta;
        this.musicItemProvider = deps.musicItemProvider;
        this.windowManager = deps.windowManager ?? null;

        const userDataPath = globalContext.appPath.userData;

        // 初始化路径
        this.pluginBasePath = path.join(userDataPath, PLUGIN_DIR_NAME);
        this.cachePath = path.join(userDataPath, PLUGIN_CACHE_FILE_NAME);
        this.metaPath = path.join(userDataPath, PLUGIN_META_FILE_NAME);

        // 确保插件目录存在
        if (!fs.existsSync(this.pluginBasePath)) {
            fs.mkdirSync(this.pluginBasePath, { recursive: true });
        }

        // 初始化插件存储
        this.pluginStorage = new PluginStorage(userDataPath);

        // 加载 meta
        this.loadMeta();

        // 注册 IPC handler
        this.registerIpcHandlers();

        // 异步加载全部插件
        this.pluginsReadyPromise = this.loadAllPlugins();

        this.isSetup = true;
    }

    /** 设置 windowManager（延迟注入） */
    public setWindowManager(windowManager: IWindowManager): void {
        this.windowManager = windowManager;
    }

    /** 等待所有插件加载完成 */
    public async whenReady(): Promise<void> {
        await this.pluginsReadyPromise;
    }

    /**
     * 获取媒体源（主进程内部调用，供 downloadManager 等模块通过 DI 使用）。
     * 包含音质回退、重试和音源重定向逻辑。
     */
    public async getMediaSource(
        musicItem: IMusic.IMusicItem,
        quality: IMusic.IQualityKey,
        qualityOrder: IMusic.IQualityKey[],
        qualityFallbackOrder: 'higher' | 'lower',
    ): Promise<import('@appTypes/infra/pluginManager').IGetMediaSourceResult | null> {
        await this.pluginsReadyPromise;
        const plugin = this.findPluginByPlatform(musicItem.platform);
        if (!plugin) return null;
        const resolvedHash = this.resolveSourceRedirectHash(plugin.hash);
        return getMediaSourceAdapter(
            { musicItem, quality, qualityOrder, qualityFallbackOrder, hash: resolvedHash },
            (p) => this.callPluginMethod(p),
        );
    }

    /**
     * 注册内建插件。
     * 业务层调用此方法注册本地插件等内建插件。
     * 内建插件不从磁盘加载，hash 和 path 由调用方指定。
     */
    public registerBuiltinPlugin(instance: IPlugin.IPluginInstance, hash: string): void {
        this.builtinPlugins.set(instance.platform, instance);

        const delegate = extractPluginDelegate(instance, hash);
        const loaded: ILoadedPlugin = { instance, hash, delegate };
        this.plugins.set(hash, loaded);

        this.onPluginListChanged();
    }

    /** 应用退出时调用 */
    public dispose(): void {
        this.pluginStorage?.flush();
    }

    // ─── 安装/卸载/更新 ───

    /**
     * 安装插件：支持 URL（http/https）、本地 .js 文件、或包含 plugins 数组的 .json 文件。
     * JSON 格式：{ plugins: [{ url: "https://..." }, ...] }
     */
    public async installPlugin(urlOrPath: string): Promise<{ success: boolean; message?: string }> {
        // JSON 批量安装支持
        if (urlOrPath.endsWith('.json')) {
            return this.installPluginsFromJson(urlOrPath);
        }

        return this.installSinglePlugin(urlOrPath);
    }

    // ─── IPC 注册 ───

    private registerIpcHandlers(): void {
        // 调用插件方法（需等待插件加载完成）
        ipcMain.handle(IPC_CALL_PLUGIN_METHOD, async (_evt, params: ICallPluginMethodParams) => {
            await this.pluginsReadyPromise;
            return this.callPluginMethod(params);
        });

        // 安装插件（需等待插件加载完成，以正确判断重复/版本）
        ipcMain.handle(IPC_INSTALL_PLUGIN, async (_evt, urlOrPath: string) => {
            await this.pluginsReadyPromise;
            return this.installPlugin(urlOrPath);
        });

        // 卸载插件
        ipcMain.handle(IPC_UNINSTALL_PLUGIN, async (_evt, hash: string) => {
            await this.pluginsReadyPromise;
            return this.uninstallPlugin(hash);
        });

        // 更新插件
        ipcMain.handle(IPC_UPDATE_PLUGIN, async (_evt, hash: string) => {
            await this.pluginsReadyPromise;
            return this.updatePlugin(hash);
        });

        // 批量更新
        ipcMain.handle(IPC_UPDATE_ALL_PLUGINS, async () => {
            await this.pluginsReadyPromise;
            return this.updateAllPlugins();
        });

        // 获取所有插件 delegate（需等待加载完成以返回完整列表）
        ipcMain.handle(IPC_GET_ALL_PLUGINS, async () => {
            await this.pluginsReadyPromise;
            return this.getAllPluginDelegates();
        });

        // 设置插件 meta
        ipcMain.handle(
            IPC_SET_PLUGIN_META,
            (_evt, hash: string, meta: Partial<IPlugin.IPluginMeta>) => {
                this.setPluginMeta(hash, meta);
            },
        );

        // 批量设置插件 meta（单次落盘）
        ipcMain.handle(
            IPC_BATCH_SET_PLUGIN_META,
            (_evt, updates: Array<{ hash: string; meta: Partial<IPlugin.IPluginMeta> }>) => {
                this.batchSetPluginMeta(updates);
            },
        );

        // 获取所有插件 meta
        ipcMain.handle(IPC_GET_ALL_PLUGIN_META, () => {
            return this.pluginMeta;
        });

        // getLyric 适配器（主进程处理，含本地 .lrc 文件读取）
        ipcMain.handle(IPC_GET_LYRIC, async (_evt, params: IGetLyricParams) => {
            await this.pluginsReadyPromise;
            return getLyricAdapter(
                params,
                (p) => this.callPluginMethod(p as any),
                this.mediaMeta,
                this.musicItemProvider,
            );
        });

        // getMediaSource 适配器（主进程处理，含音质回退、重试和音源重定向）
        ipcMain.handle(IPC_GET_MEDIA_SOURCE, async (_evt, params: IGetMediaSourceAdapterParams) => {
            await this.pluginsReadyPromise;
            const resolvedHash = this.resolveSourceRedirectHash(params.hash);
            return getMediaSourceAdapter({ ...params, hash: resolvedHash }, (p) =>
                this.callPluginMethod(p),
            );
        });
    }

    // ─── 插件加载 ───

    /** 从磁盘加载全部插件 */
    private async loadAllPlugins(): Promise<void> {
        try {
            const files = fs.readdirSync(this.pluginBasePath).filter((f) => f.endsWith('.js'));
            const loadedHashes = new Set<string>(this.plugins.keys()); // 包含已注册的内建插件

            for (const file of files) {
                const filePath = path.join(this.pluginBasePath, file);

                try {
                    const code = fs.readFileSync(filePath, 'utf-8');
                    const hash = computeHash(code);

                    // 跳过空哈希和重复哈希
                    if (!hash || loadedHashes.has(hash)) {
                        continue;
                    }

                    const instance = executePluginCode(
                        code,
                        hash,
                        this.pluginStorage!,
                        filePath,
                        this.buildSandboxOptions(hash),
                    );
                    if (!instance) continue;

                    const delegate = extractPluginDelegate(instance, hash);
                    this.plugins.set(hash, { instance, hash, delegate });
                    loadedHashes.add(hash);
                } catch (err) {
                    console.error(`[PluginManager] Failed to load plugin file ${file}:`, err);
                }
            }

            console.log(`[PluginManager] Loaded ${this.plugins.size} plugins`);

            // 为没有 order 的插件分配默认值，避免更新后 hash 变化导致顺序乱掉
            this.assignDefaultOrder();

            // 更新缓存
            this.updateCache();
        } catch (err) {
            console.error('[PluginManager] Failed to load plugins:', err);
        }
    }

    // ─── 插件调用核心 ───

    /**
     * 统一的插件方法调用入口。
     * 1. 通过 hash 或 platform 查找插件实例
     * 2. beforeCall 清洗参数
     * 3. 调用插件方法
     * 4. afterCall 标准化返回值
     */
    private async callPluginMethod(params: ICallPluginMethodParams): Promise<any> {
        const { hash, platform, method, args } = params;

        // 支持通过 hash 或 platform 查找
        let loaded: ILoadedPlugin | undefined;
        if (hash) {
            loaded = this.plugins.get(hash);
        } else if (platform) {
            loaded = this.findPluginByPlatform(platform);
        }

        if (!loaded) {
            throw new Error(`[PluginManager] Plugin not found: ${hash ?? platform}`);
        }

        const { instance } = loaded;
        const pluginPlatform = instance.platform;
        const normalizer = methodNormalizers[method];

        // 检查插件是否实现了该方法
        const methodFn = (instance as any)[method];
        if (typeof methodFn !== 'function') {
            // 使用默认返回值（如有）
            if (normalizer?.defaultResult) {
                return normalizer.defaultResult(args);
            }
            throw new Error(
                `[PluginManager] Method ${method} not implemented by ${pluginPlatform}`,
            );
        }

        // beforeCall：清洗输入参数
        let processedArgs: any[] = [...args];
        if (normalizer?.beforeCall) {
            processedArgs = normalizer.beforeCall(processedArgs);
        }

        // 调用插件方法
        let result = await methodFn.apply(instance, processedArgs);

        // afterCall：标准化输出
        if (normalizer?.afterCall) {
            result = normalizer.afterCall(result, pluginPlatform, args);
        }

        return result;
    }

    /** JSON 批量安装 */
    private async installPluginsFromJson(
        jsonUrlOrPath: string,
    ): Promise<{ success: boolean; message?: string }> {
        try {
            let jsonText: string;

            if (jsonUrlOrPath.startsWith('http://') || jsonUrlOrPath.startsWith('https://')) {
                const resp = await axios.get(this.addRandomHash(jsonUrlOrPath), {
                    timeout: 15000,
                    responseType: 'text',
                });
                jsonText = resp.data;
            } else {
                jsonText = fs.readFileSync(jsonUrlOrPath, 'utf-8');
            }

            const jsonData = JSON.parse(jsonText);
            const pluginUrls: string[] = (jsonData?.plugins ?? [])
                .map((p: any) => p?.url)
                .filter(Boolean);

            if (pluginUrls.length === 0) {
                return { success: false, message: 'No plugin URLs found in JSON' };
            }

            let installed = 0;
            let failed = 0;
            for (const url of pluginUrls) {
                const result = await this.installSinglePlugin(url);
                if (result.success) {
                    installed++;
                } else {
                    failed++;
                }
            }

            return {
                success: installed > 0,
                message: `Installed: ${installed}, Failed: ${failed}`,
            };
        } catch (err: any) {
            return { success: false, message: err?.message ?? 'Failed to parse JSON' };
        }
    }

    /** 安装单个插件 */
    private async installSinglePlugin(
        urlOrPath: string,
    ): Promise<{ success: boolean; message?: string }> {
        try {
            let code: string;

            if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
                // 远程下载（添加随机参数防止缓存）
                const resp = await axios.get(this.addRandomHash(urlOrPath), {
                    timeout: 15000,
                    responseType: 'text',
                });
                code = resp.data;
            } else {
                // 本地文件
                code = fs.readFileSync(urlOrPath, 'utf-8');
            }

            const hash = computeHash(code);
            if (!hash) {
                return { success: false, message: 'Empty plugin code' };
            }

            // 检查是否已安装相同哈希的插件
            if (this.plugins.has(hash)) {
                return { success: false, message: 'Plugin already installed' };
            }

            // 写入文件
            const fileName = `${nanoid()}.js`;
            const filePath = path.join(this.pluginBasePath, fileName);
            fs.writeFileSync(filePath, code, 'utf-8');

            // 在沙箱中执行（使用真实路径，避免重复执行）
            const instance = executePluginCode(
                code,
                hash,
                this.pluginStorage!,
                filePath,
                this.buildSandboxOptions(hash),
            );
            if (!instance) {
                // 清理
                try {
                    fs.unlinkSync(filePath);
                } catch {
                    /* ignore */
                }
                return { success: false, message: 'Failed to parse plugin' };
            }

            // 检查是否有同平台的旧版插件
            const existingEntry = this.findPluginByPlatform(instance.platform);
            if (existingEntry) {
                // 版本比较：仅在新版本更高时安装（可通过配置跳过）
                const skipVersionCheck =
                    this.appConfigReader?.getConfigByKey('plugin.notCheckPluginVersion') ?? false;
                if (
                    !skipVersionCheck &&
                    existingEntry.instance.version &&
                    instance.version &&
                    compare(existingEntry.instance.version, instance.version, '>')
                ) {
                    // 回滚：删除刚写入的文件
                    try {
                        fs.unlinkSync(filePath);
                    } catch {
                        /* ignore */
                    }
                    return {
                        success: false,
                        message: `Existing version ${existingEntry.instance.version} >= ${instance.version}`,
                    };
                }

                // 删除旧插件文件
                this.removePluginFile(existingEntry);
                this.plugins.delete(existingEntry.hash);
            }

            const delegate = extractPluginDelegate(instance, hash);
            this.plugins.set(hash, { instance, hash, delegate });

            this.onPluginListChanged();
            return { success: true };
        } catch (err: any) {
            console.error('[PluginManager] Install failed:', err);
            return { success: false, message: err?.message ?? 'Unknown error' };
        }
    }

    /** 卸载插件 */
    private async uninstallPlugin(hash: string): Promise<{ success: boolean; message?: string }> {
        const loaded = this.plugins.get(hash);
        if (!loaded) {
            return { success: false, message: 'Plugin not found' };
        }

        // 删除文件
        this.removePluginFile(loaded);

        // 清除存储
        this.pluginStorage?.clearPlugin(hash);

        // 清除 meta
        delete this.pluginMeta[hash];
        this.saveMeta();

        // 移除记录
        this.plugins.delete(hash);

        this.onPluginListChanged();
        return { success: true };
    }

    /** 更新单个插件：先下载验证新版本，成功后再替换旧版本 */
    private async updatePlugin(hash: string): Promise<{ success: boolean; message?: string }> {
        const loaded = this.plugins.get(hash);
        if (!loaded) {
            return { success: false, message: 'Plugin not found' };
        }

        const srcUrl = loaded.instance.srcUrl;
        if (!srcUrl) {
            return { success: false, message: 'Plugin has no srcUrl for update' };
        }

        try {
            // 先下载并验证新版本
            const resp = await axios.get(this.addRandomHash(srcUrl), {
                timeout: 15000,
                responseType: 'text',
            });
            const newCode = resp.data as string;
            const newHash = computeHash(newCode);

            if (!newHash || newHash === hash) {
                return { success: false, message: 'No update available' };
            }

            const testInstance = executePluginCode(
                newCode,
                newHash,
                this.pluginStorage!,
                '',
                this.buildSandboxOptions(newHash),
            );
            if (!testInstance) {
                return { success: false, message: 'Failed to parse new plugin version' };
            }

            // 版本比较（如有版本号，可通过配置跳过）
            const skipVersionCheck =
                this.appConfigReader?.getConfigByKey('plugin.notCheckPluginVersion') ?? false;
            if (
                !skipVersionCheck &&
                loaded.instance.version &&
                testInstance.version &&
                compare(loaded.instance.version, testInstance.version, '>=')
            ) {
                return {
                    success: false,
                    message: `Current ${loaded.instance.version} >= new ${testInstance.version}`,
                };
            }

            // 新版本验证通过，写入文件
            const fileName = `${nanoid()}.js`;
            const filePath = path.join(this.pluginBasePath, fileName);
            fs.writeFileSync(filePath, newCode, 'utf-8');

            // 删除旧插件文件（不清除存储和 meta）
            this.removePluginFile(loaded);
            this.plugins.delete(hash);

            // 复用已验证的 testInstance，更新其 _path 为实际文件路径
            testInstance._path = filePath;

            const delegate = extractPluginDelegate(testInstance, newHash);
            this.plugins.set(newHash, { instance: testInstance, hash: newHash, delegate });

            // 迁移 meta 到新 hash
            if (this.pluginMeta[hash]) {
                this.pluginMeta[newHash] = this.pluginMeta[hash];
                delete this.pluginMeta[hash];
                this.saveMeta();
            }

            this.onPluginListChanged();
            return { success: true };
        } catch (err: any) {
            console.error('[PluginManager] Update failed:', err);
            return { success: false, message: err?.message ?? 'Unknown error' };
        }
    }

    /** 批量更新全部插件 */
    private async updateAllPlugins(): Promise<{ updated: number; failed: number }> {
        let updated = 0;
        let failed = 0;

        // 收集需要更新的插件（有 srcUrl 的非内建插件）
        const updatable: ILoadedPlugin[] = [];
        for (const loaded of this.plugins.values()) {
            if (loaded.instance.srcUrl && !this.builtinPlugins.has(loaded.instance.platform)) {
                updatable.push(loaded);
            }
        }

        for (const loaded of updatable) {
            const result = await this.updatePlugin(loaded.hash);
            if (result.success) {
                updated++;
            } else {
                failed++;
            }
        }

        return { updated, failed };
    }

    // ─── 查询 ───

    /** 获取所有插件的 delegate 列表 */
    private getAllPluginDelegates(): IPlugin.IPluginDelegate[] {
        return Array.from(this.plugins.values()).map((p) => p.delegate);
    }

    /** 通过 platform 查找插件 */
    private findPluginByPlatform(platform: string): ILoadedPlugin | undefined {
        for (const loaded of this.plugins.values()) {
            if (loaded.instance.platform === platform) {
                return loaded;
            }
        }
        return undefined;
    }

    /**
     * 解析音源重定向：检查源插件是否设置了 sourceRedirectPlatform，
     * 如果目标插件存在且支持 getMediaSource，则返回目标插件的 hash。
     * 只做一层重定向（不递归），避免循环。
     */
    private resolveSourceRedirectHash(sourceHash: string): string {
        const meta = this.pluginMeta[sourceHash];
        const redirectPlatform = meta?.sourceRedirectPlatform;
        if (!redirectPlatform) return sourceHash;

        const target = this.findPluginByPlatform(redirectPlatform);
        if (!target) return sourceHash;

        // 目标插件必须支持 getMediaSource
        if (typeof target.instance.getMediaSource !== 'function') return sourceHash;

        // 避免重定向到自身
        if (target.hash === sourceHash) return sourceHash;

        return target.hash;
    }

    /**
     * 构建沙箱选项：将运行时上下文（用户变量、语言等）注入到沙箱环境。
     * getUserVariables 通过闭包捕获 hash，在插件方法调用时动态读取最新值。
     */
    private buildSandboxOptions(hash: string): ISandboxOptions {
        return {
            getUserVariables: () => {
                const meta = this.pluginMeta[hash];
                return meta?.userVariables ?? {};
            },
            getLang: () => {
                try {
                    return this.appConfigReader?.getConfigByKey('normal.language') ?? '';
                } catch {
                    return '';
                }
            },
        };
    }

    // ─── Meta 管理 ───

    /** 设置插件 meta */
    private setPluginMeta(hash: string, meta: Partial<IPlugin.IPluginMeta>): void {
        this.pluginMeta[hash] = {
            ...this.pluginMeta[hash],
            ...meta,
        };
        this.saveMeta();
    }

    /** 批量设置插件 meta（单次落盘） */
    private batchSetPluginMeta(
        updates: Array<{ hash: string; meta: Partial<IPlugin.IPluginMeta> }>,
    ): void {
        for (const { hash, meta } of updates) {
            this.pluginMeta[hash] = {
                ...this.pluginMeta[hash],
                ...meta,
            };
        }
        this.saveMeta();
    }

    /** 加载 meta */
    private loadMeta(): void {
        try {
            if (fs.existsSync(this.metaPath)) {
                const raw = fs.readFileSync(this.metaPath, 'utf-8');
                this.pluginMeta = JSON.parse(raw) ?? {};
            }
        } catch (err) {
            console.error('[PluginManager] Failed to load plugin meta:', err);
            this.pluginMeta = {};
        }
    }

    /** 保存 meta */
    private saveMeta(): void {
        try {
            fs.writeFileSync(this.metaPath, JSON.stringify(this.pluginMeta), 'utf-8');
        } catch (err) {
            console.error('[PluginManager] Failed to save plugin meta:', err);
        }
    }

    /** 为没有 order 的插件分配默认值（按加载顺序递增） */
    private assignDefaultOrder(): void {
        let maxOrder = -1;
        for (const meta of Object.values(this.pluginMeta)) {
            if (meta?.order !== undefined && meta.order > maxOrder) {
                maxOrder = meta.order;
            }
        }

        let needSave = false;
        for (const loaded of this.plugins.values()) {
            if (this.pluginMeta[loaded.hash]?.order === undefined) {
                maxOrder++;
                this.pluginMeta[loaded.hash] = {
                    ...this.pluginMeta[loaded.hash],
                    order: maxOrder,
                };
                needSave = true;
            }
        }

        if (needSave) {
            this.saveMeta();
        }
    }

    // ─── 缓存 ───

    /** 更新插件缓存文件（供 preload 首帧渲染使用） */
    private updateCache(): void {
        try {
            const cacheData = {
                plugins: this.getAllPluginDelegates(),
            };
            fs.writeFileSync(this.cachePath, JSON.stringify(cacheData), 'utf-8');
        } catch (err) {
            console.error('[PluginManager] Failed to update cache:', err);
        }
    }

    // ─── 内部工具 ───

    /** 删除插件文件 */
    private removePluginFile(loaded: ILoadedPlugin): void {
        const filePath = loaded.instance._path;
        if (filePath) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error(`[PluginManager] Failed to remove plugin file ${filePath}:`, err);
            }
        }
    }

    /** 插件列表变更时的统一处理 */
    private onPluginListChanged(): void {
        this.updateCache();

        // 广播到所有渲染进程
        const delegates = this.getAllPluginDelegates();
        this.windowManager?.broadcast(IPC_PLUGIN_LIST_CHANGED, delegates);
    }

    /** 在 URL 后添加随机参数，防止 CDN/浏览器缓存 */
    private addRandomHash(url: string): string {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.set('_t', Date.now().toString());
            return urlObj.toString();
        } catch {
            // 非法 URL，原样返回
            return url;
        }
    }
}

const pluginManager = new PluginManager();
export default pluginManager;
