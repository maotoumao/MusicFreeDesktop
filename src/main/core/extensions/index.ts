// 同步某些状态到其他创库

import { ipcMainSend } from "@/common/ipc-util/main";
import { BrowserWindow } from "electron";

const extensions = new Set<BrowserWindow>();

export function registerExtension(bWindow: BrowserWindow) {
  extensions.add(bWindow);
}

export function unregisterExtension(bWindow: BrowserWindow) {
  extensions.delete(bWindow);
}

/** 向扩展进程同步数据 */
export function syncExtensionData(
  data: IpcEvents.IExtensionWindowSyncData["data"],
  targetWindow?: BrowserWindow
) {
  (targetWindow ? [targetWindow] : extensions).forEach((bWindow) => {
    if (bWindow) {
      ipcMainSend(bWindow, "sync-extension-data", {
        timeStamp: Date.now(),
        data,
      });
    }
  });
}


export function getExtensionWindow(webContentId: number) {
    return [...extensions].find(item => item.webContents.id === webContentId)
}