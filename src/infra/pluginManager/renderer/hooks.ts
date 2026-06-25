/**
 * pluginManager — React Hooks
 *
 * 提供插件状态的 React Hook 封装，组件直接使用 hook 订阅状态，
 * 不再需要手动操作 atom。
 *
 * 基础 Hook：
 *   usePlugins()      — 插件 delegate 列表
 *   usePluginMeta()   — 全量插件 meta
 *
 * 派生 Hook（内建 useMemo，自动窄化依赖）：
 *   useSortedSupportedPlugins(method)       — 支持指定方法的插件（按 order 排序）
 *   useSortedSearchablePlugins(searchType?) — 支持搜索的插件（可选按搜索类型过滤，按 order 排序）
 */

import { useMemo } from 'react';
import { useAtomValue } from 'jotai/react';
import { pluginsAtom, pluginMetaAtom } from './store';
import { sortByPluginOrder } from '../common/sortByOrder';

// ─── 基础 Hooks ───

/** 订阅插件列表 */
export const usePlugins = () => useAtomValue(pluginsAtom);

/** 订阅插件 meta */
export const usePluginMeta = () => useAtomValue(pluginMetaAtom);

// ─── 派生 Hooks ───
// 注意：派生 hook 同时订阅 pluginsAtom 和 pluginMetaAtom，
// 任一更新都会触发 re-render + useMemo 重算。如果成为性能瓶颈，
// 可改用 jotai derived atom 做细粒度选择。目前场景下开销可忽略。

/**
 * 获取支持指定方法的插件列表（按 meta.order 排序）。
 *
 * @param featureMethod - 插件实例方法名
 * @param enabledOnly - 仅返回已启用的插件（默认 true）
 */
export function useSortedSupportedPlugins(
    featureMethod: keyof IPlugin.IPluginInstanceMethods,
    enabledOnly = true,
): IPlugin.IPluginDelegate[] {
    const plugins = useAtomValue(pluginsAtom);
    const meta = useAtomValue(pluginMetaAtom);

    return useMemo(
        () =>
            sortByPluginOrder(
                plugins.filter(
                    (p) =>
                        p.supportedMethod.includes(featureMethod) &&
                        (!enabledOnly || meta[p.hash]?.enabled !== false),
                ),
                meta,
            ),
        [plugins, meta, featureMethod, enabledOnly],
    );
}

/**
 * 获取支持搜索功能的插件列表（按 meta.order 排序）。
 *
 * @param supportedSearchType - 可选，限定搜索类型（music / album / artist / sheet）
 * @param enabledOnly - 仅返回已启用的插件（默认 true）
 */
export function useSortedSearchablePlugins(
    supportedSearchType?: IMedia.SupportMediaType,
    enabledOnly = true,
): IPlugin.IPluginDelegate[] {
    const plugins = useAtomValue(pluginsAtom);
    const meta = useAtomValue(pluginMetaAtom);

    return useMemo(
        () =>
            sortByPluginOrder(
                plugins
                    .filter(
                        (p) =>
                            p.supportedMethod.includes('search') &&
                            (!enabledOnly || meta[p.hash]?.enabled !== false),
                    )
                    .filter((p) =>
                        supportedSearchType && p.supportedSearchType
                            ? p.supportedSearchType.includes(supportedSearchType)
                            : true,
                    ),
                meta,
            ),
        [plugins, meta, supportedSearchType, enabledOnly],
    );
}
