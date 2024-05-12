/** 主进程ipc封装 */
import { getMainWindow } from "@/main/window";
import {
  BrowserWindow,
  IpcMainEvent,
  IpcMainInvokeEvent,
  ipcMain,
} from "electron";

/** 主进程监听 */
export function ipcMainOn<T extends keyof IpcEvents.Renderer>(
  channel: T,
  callback: (args: IpcEvents.Renderer[T], evt: IpcMainEvent) => void
) {
  ipcMain.on(channel, (evt, args) => {
    callback(args, evt);
  });
}

/** 主进程停止监听 */
export function ipcMainOff<T extends keyof IpcEvents.Renderer>(
  channel?: T,
  callback?: (args: IpcEvents.Renderer[T], evt: IpcMainEvent) => void
) {
  if (callback) {
    ipcMain.removeListener(channel, callback);
  } else {
    ipcMain.removeAllListeners(channel);
  }
}

/** 主进程处理，需要返回值 */
export function ipcMainHandle<T extends keyof IpcInvoke.Renderer>(
  channel?: T,
  callback?: (
    args: Parameters<IpcInvoke.Renderer[T]>[0],
    evt: IpcMainInvokeEvent
  ) =>
    | ReturnType<IpcInvoke.Renderer[T]>
    | PromiseLike<ReturnType<IpcInvoke.Renderer[T]>>
) {
  ipcMain.handle(channel, (evt, args) => {
    return callback(args, evt);
  });
}

/** 主进程给渲染进程发送消息 */
export function ipcMainSend<T extends keyof IpcEvents.Main>(
  rendererWindow: BrowserWindow,
  channel: T,
  args?: IpcEvents.Main[T]
) {
  rendererWindow.webContents.send(channel, args);
}

/** 主进程给主窗口发送消息 */
export function ipcMainSendMainWindow<T extends keyof IpcEvents.Main>(
  channel: T,
  args?: IpcEvents.Main[T]
) {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send(channel, args);
  }
}
