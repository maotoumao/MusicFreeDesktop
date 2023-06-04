import { ipcRendererSend } from "@/common/ipc-util/renderer";
import serializablePluginsStore from "./store";

/** 刷新插件 */
export function refreshPlugins(){
    ipcRendererSend('refresh-plugins');
}

export function getSupportedPlugin(featureMethod: keyof IPlugin.IPluginInstanceMethods) {
    return serializablePluginsStore.getValue().filter(_ => _.supportedMethod.includes(featureMethod));
}

export function useSupportedPlugin(featureMethod: keyof IPlugin.IPluginInstanceMethods) {
    return serializablePluginsStore.useValue().filter(_ => _.supportedMethod.includes(featureMethod));
}