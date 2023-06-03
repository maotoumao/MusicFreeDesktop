import { ipcRendererSend } from "@/common/ipc-util/renderer";

/** 刷新插件 */
export function refreshPlugins(){
    ipcRendererSend('refresh-plugins');
}