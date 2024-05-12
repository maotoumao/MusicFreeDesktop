// 同步某些状态到其他

import { ipcMainSend } from "@/shared/ipc/main";
import { getMainWindow } from "@/main/window";
import { BrowserWindow, MessageChannelMain, MessagePortMain } from "electron";

const extensions = new Set<BrowserWindow>();

interface IExtensionData {
  portMain: MessagePortMain;
  portExt: MessagePortMain;
}

const extensionsData = new Set<number>();

// 创建用来通信的端口
export function registerExtension(bWindow: BrowserWindow) {
  const { port1, port2 } = new MessageChannelMain();
  const extWindowId = bWindow.id;

  extensionsData.add(extWindowId);

  // 通知主窗口有更新
  getMainWindow().webContents.postMessage(
    "port",
    {
      id: extWindowId,
      type: "mount",
    },
    [port1]
  );
  bWindow.webContents.postMessage("port", null, [port2]);

  // 卸载
  bWindow.on("close", () => {
    getMainWindow().webContents.postMessage("port", {
      id: extWindowId,
      type: "unmount",
    });
    extensionsData.delete(extWindowId);
  });
}

/** 向扩展进程同步数据 */
// export function syncExtensionData(
//   data: IpcEvents.IExtensionWindowSyncData["data"],
//   targetWindow?: BrowserWindow
// ) {
//   (targetWindow ? [targetWindow] : extensions).forEach((bWindow) => {
//     if (bWindow) {
//       ipcMainSend(bWindow, "sync-extension-data", {
//         timeStamp: Date.now(),
//         data,
//       });
//     }
//   });
// }

export function getExtensionWindow(webContentId: number) {
  return [...extensions].find((item) => item.webContents.id === webContentId);
}
