/**
 * pluginManager — 排序工具函数
 *
 * 提供插件按 meta.order 排序的通用函数，
 * 在 hooks.ts（React 响应式）和 renderer.ts（命令式快照）中共享，
 * 避免排序逻辑漂移。
 */

import type { IPluginMetaAll } from '@appTypes/infra/pluginManager';

/**
 * 按 meta.order 升序对插件列表排序（返回新数组）。
 *
 * 没有 order 的插件视为 Infinity（排到最后）。
 */
export function sortByPluginOrder(
    plugins: IPlugin.IPluginDelegate[],
    meta: IPluginMetaAll,
): IPlugin.IPluginDelegate[] {
    return [...plugins].sort(
        (a, b) => (meta[a.hash]?.order ?? Infinity) - (meta[b.hash]?.order ?? Infinity),
    );
}
