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
  data: IpcEvents.IExtensionWindowSyncData["data"]
) {
  extensions.forEach((bWindow) => {
    if (bWindow) {
      ipcMainSend(bWindow, "sync-extension-data", {
        timeStamp: Date.now(),
        data,
      });
    }
  });
}
