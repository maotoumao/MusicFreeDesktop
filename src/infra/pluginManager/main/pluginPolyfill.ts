/**
 * pluginManager — 插件沙箱 Polyfill
 *
 * 插件沙箱在 vm.createContext 中运行，没有 Node.js 的 require。
 * 此模块提供一个受限的 _require 函数，允许插件引用白名单中的模块。
 *
 * 注意：所有模块均为延迟加载（lazy require），避免不必要的启动开销。
 */

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * 创建插件沙箱中可用的 _require 函数。
 * 白名单模块列表参考旧版 plugin-manager。
 *
 * @param getItem 插件存储的 getItem 函数
 * @param setItem 插件存储的 setItem 函数
 * @param removeItem 插件存储的 removeItem 函数
 */
export function createPluginRequire(
    getItem: (key: string) => string | null,
    setItem: (key: string, value: string) => void,
    removeItem: (key: string) => void,
): (moduleId: string) => any {
    const moduleCache: Record<string, any> = {};

    return function _require(moduleId: string): any {
        if (moduleCache[moduleId]) {
            return moduleCache[moduleId];
        }

        let mod: any;

        switch (moduleId) {
            case 'cheerio':
                mod = require('cheerio');
                break;
            case 'axios':
                mod = require('axios').default ?? require('axios');
                break;
            case 'dayjs':
                mod = require('dayjs');
                break;
            case 'big-integer':
                mod = require('big-integer');
                break;
            case 'qs':
                mod = require('qs');
                break;
            case 'he':
                mod = require('he');
                break;
            case 'crypto-js':
                mod = require('crypto-js');
                break;
            case 'webdav':
                mod = require('webdav');
                break;
            case '@musicfree/storage':
            case 'musicfree/storage': {
                // 提供一个命名空间隔离的存储对象
                mod = {
                    getItem,
                    setItem,
                    removeItem,
                };
                break;
            }
            default:
                throw new Error(`Module "${moduleId}" is not available in plugin sandbox`);
        }

        // 旧版兼容：设置 .default 属性（与旧版 _require 行为一致）
        if (mod && typeof mod === 'object' && !mod.default) {
            mod.default = mod;
        }

        moduleCache[moduleId] = mod;
        return mod;
    };
}
