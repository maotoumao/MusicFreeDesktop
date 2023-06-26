// @ts-nocheck
/** 渲染进程ipc封装 */
import { IpcRendererEvent } from "electron";

/** 渲染进程监听 */
export function ipcRendererOn<T extends keyof IpcEvents.Main>(
  channel: T,
  callback: (args: IpcEvents.Main[T], evt: IpcRendererEvent) => void
) {
  window.ipcRenderer.on(channel, (evt, args) => {
    callback(args, evt);
  });
}

/** 渲染进程停止监听 */
export function ipcRendererOff<T extends keyof IpcEvents.Main>(
  channel?: T,
  callback?: (args: IpcEvents.Main[T], evt: IpcRendererEvent) => void
) {
  if (callback) {
    window.ipcRenderer.removeListener(channel, callback);
  } else {
    window.ipcRenderer.removeAllListeners(channel);
  }
}

/** 渲染进程给主进程发送消息 */
export function ipcRendererSend<T extends keyof IpcEvents.Renderer>(
  channel: T,
  args: IpcEvents.Renderer[T] = undefined
) {
  window.ipcRenderer.send(channel, args);
}

type PromiseContent<T> = T extends Promise<infer R> ? R : T;

/** 渲染进程给主进程发送消息，需要回调 */
export async function ipcRendererInvoke<T extends keyof IpcInvoke.Renderer>(
  channel: T,
  args?: Parameters<IpcInvoke.Renderer[T]>[0]
): Promise<PromiseContent<ReturnType<IpcInvoke.Renderer[T]>>> {
  return await window.ipcRenderer.invoke(channel, args);
}
