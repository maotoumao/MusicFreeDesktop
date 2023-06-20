import { ipcRendererInvoke, ipcRendererSend } from "@/common/ipc-util/renderer";
import delegatePluginsStore from "./store";

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

export function useSupportedPlugin(
  featureMethod: keyof IPlugin.IPluginInstanceMethods
) {
  return delegatePluginsStore
    .useValue()
    .filter((_) => _.supportedMethod.includes(featureMethod));
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
  return await ipcRendererInvoke("call-plugin-method", {
    hash: pluginDelegate.hash,
    platform: pluginDelegate.platform,
    method,
    args,
  }) as ReturnType<IPlugin.IPluginInstanceMethods[T]>;
}
