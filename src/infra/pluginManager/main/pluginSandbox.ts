/**
 * pluginManager — 插件沙箱
 *
 * 使用 Node.js vm.createContext 创建安全的插件运行环境。
 * 每个插件在独立的 Context 中执行，通过 Proxy 冻结全局对象防止逃逸。
 * 使用 Node.js crypto 计算插件代码的 SHA256 哈希值作为唯一标识。
 */

import vm from 'vm';
import crypto from 'crypto';
import { createPluginRequire } from './pluginPolyfill';
import type { PluginStorage } from './pluginStorage';

/**
 * 沙箱环境配置选项。
 * 由 PluginManager 传入，用于注入运行时上下文（env、process 等）。
 */
export interface ISandboxOptions {
    /**
     * 延迟获取用户变量的回调。
     * 插件代码通过 env.getUserVariables() 调用，运行时动态读取。
     */
    getUserVariables?: () => Record<string, string>;

    /**
     * 延迟获取当前语言的回调。
     */
    getLang?: () => string;
}

/** 计算代码的 SHA256 哈希 */
export function computeHash(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * 创建受保护的沙箱全局对象。
 * 使用 Proxy 保护预注入的全局变量不被覆盖或删除，
 * 但允许插件代码创建新的全局变量（var/function 声明需要）。
 */
function createProtectedGlobal(globals: Record<string, any>): Record<string, any> {
    const frozenKeys = new Set(Object.keys(globals));

    return new Proxy(globals, {
        set(target, prop, value) {
            // 禁止覆盖预注入的全局变量
            if (frozenKeys.has(prop as string)) {
                return false;
            }
            // 允许插件声明新变量
            target[prop as string] = value;
            return true;
        },
        deleteProperty(target, prop) {
            if (frozenKeys.has(prop as string)) {
                return false;
            }
            delete target[prop as string];
            return true;
        },
        defineProperty(target, prop, descriptor) {
            if (frozenKeys.has(prop as string)) {
                return false;
            }
            Object.defineProperty(target, prop, descriptor);
            return true;
        },
    });
}

/**
 * 在沙箱中执行插件代码，返回插件的导出对象。
 *
 * 插件代码格式约定：
 * - 代码最终将 module.exports 赋值为一个对象
 * - 该对象符合 IPlugin.IPluginDefine 接口
 * - 支持 module.exports.default 回退
 *
 * @param code 插件 JS 源代码
 * @param hash 插件代码哈希（由调用方预计算，避免重复计算）
 * @param pluginStorage 插件持久化存储实例
 * @param pluginPath 插件文件路径（用于设置 _path）
 * @param sandboxOptions 可选的沙箱环境配置
 * @returns 插件实例对象，或 null（执行失败时）
 */
export function executePluginCode(
    code: string,
    hash: string,
    pluginStorage: PluginStorage,
    pluginPath: string,
    sandboxOptions?: ISandboxOptions,
): IPlugin.IPluginInstance | null {
    // 构建 module 容器
    const moduleExports: Record<string, any> = {};
    const moduleObj = { exports: moduleExports, loaded: false };

    // 插件初始化完成的 Promise
    let loadResolveCallback: (() => void) | null = null;
    const ensurePluginInitialized = new Promise<void>((resolve) => {
        loadResolveCallback = resolve;
    });

    // 构建 env 对象（对应旧版 plugin.ts 中的 env）
    const env = {
        getUserVariables: sandboxOptions?.getUserVariables ?? (() => ({})),
        os: process.platform,
        appVersion: globalContext.appVersion,
        lang: sandboxOptions?.getLang?.() ?? '',
    };

    // 构建 process 对象（对应旧版 plugin.ts 中的 _process）
    const _process = {
        platform: process.platform,
        version: globalContext.appVersion,
        env,
        ensurePluginInitialized,
    };

    // 创建 require 函数
    const _require = createPluginRequire(
        (key: string) => pluginStorage.getItem(hash, key),
        (key: string, value: string) => pluginStorage.setItem(hash, key, value),
        (key: string) => pluginStorage.removeItem(hash, key),
    );

    // 创建沙箱全局对象
    const sandboxGlobals = createProtectedGlobal({
        // Node.js 模块系统
        module: moduleObj,
        exports: moduleExports,
        require: _require,
        __musicfree_require: _require,

        // 安全的 console
        console: {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            info: console.info.bind(console),
            debug: console.debug.bind(console),
            trace: console.trace.bind(console),
        },

        // 环境对象
        env,
        process: _process,

        // 定时器
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,

        // Promise & async
        Promise,

        // URL
        URL,
        URLSearchParams,

        // 编码
        Buffer,
        TextEncoder,
        TextDecoder,
        encodeURIComponent,
        decodeURIComponent,
        encodeURI,
        decodeURI,
        escape,
        unescape,
        btoa: (s: string) => Buffer.from(s).toString('base64'),
        atob: (s: string) => Buffer.from(s, 'base64').toString(),

        // Fetch & Abort
        AbortController,
        AbortSignal,
        fetch: globalThis.fetch,
        Blob,

        // JSON
        JSON,

        // 数学/基础类型
        Math,
        Number,
        String,
        Boolean,
        Array,
        Object,
        Date,
        RegExp,
        Error,
        TypeError,
        RangeError,
        SyntaxError,
        Map,
        Set,
        WeakMap,
        WeakSet,
        Symbol,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        undefined,
        NaN,
        Infinity,
    });

    try {
        const context = vm.createContext(sandboxGlobals);

        // 编译并执行插件代码
        const script = new vm.Script(code, {
            filename: `plugin-${pluginPath || 'anonymous'}.js`,
        });

        script.runInContext(context, { timeout: 10000 });

        // 标记加载完成
        loadResolveCallback?.();
        moduleObj.loaded = true;

        // 获取导出——支持 module.exports.default 回退
        let pluginDefine: IPlugin.IPluginDefine;
        if ((moduleObj.exports as any).default) {
            pluginDefine = (moduleObj.exports as any).default as IPlugin.IPluginDefine;
        } else {
            pluginDefine = moduleObj.exports as IPlugin.IPluginDefine;
        }

        if (!pluginDefine || !pluginDefine.platform) {
            console.error(`[PluginSandbox] Plugin at ${pluginPath} has no platform defined`);
            return null;
        }

        // 过滤 userVariables：只保留有 key 的项
        if (Array.isArray(pluginDefine.userVariables)) {
            pluginDefine.userVariables = pluginDefine.userVariables.filter((it: any) => it?.key);
        }

        // 构造 IPluginInstance
        const instance: IPlugin.IPluginInstance = {
            ...pluginDefine,
            _path: pluginPath,
        };

        return instance;
    } catch (err) {
        console.error(`[PluginSandbox] Failed to execute plugin at ${pluginPath}:`, err);
        return null;
    }
}

/**
 * 从插件实例中提取 delegate（序列化安全的纯数据对象）。
 * delegate 不包含函数，可安全传递到渲染进程。
 *
 * @param instance 插件实例
 * @param hash 插件代码哈希
 */
export function extractPluginDelegate(
    instance: IPlugin.IPluginInstance,
    hash: string,
): IPlugin.IPluginDelegate {
    // 提取支持的方法名列表
    const supportedMethod: string[] = [];
    for (const key of Object.keys(instance)) {
        if (typeof (instance as any)[key] === 'function') {
            supportedMethod.push(key);
        }
    }

    // 深拷贝纯数据部分
    const raw: Record<string, any> = {};
    for (const key of Object.keys(instance)) {
        if (typeof (instance as any)[key] !== 'function') {
            raw[key] = (instance as any)[key];
        }
    }

    const delegate: IPlugin.IPluginDelegate = {
        ...JSON.parse(JSON.stringify(raw)),
        supportedMethod,
        hash,
        path: instance._path,
    };

    return delegate;
}
