import {ipcRendererInvoke, ipcRendererSend} from "@/shared/ipc/renderer";
import delegatePluginsStore from "./store";
import {useMemo} from "react";
import useAppConfig from "@/hooks/useAppConfig";
import AppConfig from "@shared/app-config.new/renderer";

/** 刷新插件 */
export function refreshPlugins() {
    ipcRendererSend("refresh-plugins");
}

export function getSupportedPlugin(
    featureMethod: keyof IPlugin.IPluginInstanceMethods
) {
    return delegatePluginsStore
        .getValue()
        .filter((_) => _.supportedMethod.includes(featureMethod));
}

export function getSortedSupportedPlugin(
    featureMethod: keyof IPlugin.IPluginInstanceMethods
) {
    const meta = AppConfig.getConfig("private.pluginMeta") ?? {};
    return delegatePluginsStore
        .getValue()
        .filter((_) => _.supportedMethod.includes(featureMethod))
        .sort((a, b) => {
            return (meta[a.platform]?.order ?? Infinity) -
            (meta[b?.platform]?.order ?? Infinity) <
            0
                ? -1
                : 1;
        });
}

export function useSupportedPlugin(
    featureMethod: keyof IPlugin.IPluginInstanceMethods
) {
    return delegatePluginsStore
        .useValue()
        .filter((_) => _.supportedMethod.includes(featureMethod));
}

export function useSortedSupportedPlugin(
    featureMethod: keyof IPlugin.IPluginInstanceMethods
) {
    const meta = AppConfig.getConfig("private.pluginMeta") ?? {};
    return delegatePluginsStore
        .useValue()
        .filter((_) => _.supportedMethod.includes(featureMethod))
        .sort((a, b) => {
            return (meta[a.platform]?.order ?? Infinity) -
            (meta[b?.platform]?.order ?? Infinity) <
            0
                ? -1
                : 1;
        });
}

export function getSearchablePlugins(
    supportedSearchType?: IMedia.SupportMediaType
) {
    return getSupportedPlugin("search").filter((_) =>
        supportedSearchType && _.supportedSearchType
            ? _.supportedSearchType.includes(supportedSearchType)
            : true
    );
}

export function getSortedSearchablePlugins(
    supportedSearchType?: IMedia.SupportMediaType
) {
    return getSortedSupportedPlugin("search").filter((_) =>
        supportedSearchType && _.supportedSearchType
            ? _.supportedSearchType.includes(supportedSearchType)
            : true
    );
}

export function getPluginByHash(hash: string) {
    return delegatePluginsStore.getValue().find((item) => item.hash === hash);
}

interface IPluginDelegateLike {
    platform?: string;
    hash?: string;
}

export async function callPluginDelegateMethod<
    T extends keyof IPlugin.IPluginInstanceMethods
>(
    pluginDelegate: IPluginDelegateLike,
    method: T,
    ...args: Parameters<IPlugin.IPluginInstanceMethods[T]>
) {
    return (await ipcRendererInvoke("call-plugin-method", {
        hash: pluginDelegate.hash,
        platform: pluginDelegate.platform,
        method,
        args,
    })) as ReturnType<IPlugin.IPluginInstanceMethods[T]>;
}

export function getPluginPrimaryKey(pluginItem: IPluginDelegateLike) {
    return (
        delegatePluginsStore
            .getValue()
            .find((it) => it.platform === pluginItem.platform)?.primaryKey ?? []
    );
}

export function useSortedPlugins() {
    const plugins = delegatePluginsStore.useValue();
    const meta = useAppConfig("private.pluginMeta") ?? {};

    return useMemo(() => {
        return [...plugins].sort((a, b) => {
            return (meta[a.platform]?.order ?? Infinity) -
            (meta[b?.platform]?.order ?? Infinity) <
            0
                ? -1
                : 1;
        });
    }, [plugins, meta]);
}
