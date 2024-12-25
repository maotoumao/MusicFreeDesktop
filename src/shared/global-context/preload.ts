import { contextBridge, ipcRenderer } from "electron";
import { IGlobalContext } from "./type";
import { _IpcRendererEvt } from "./internal/common";

let globalContext: IGlobalContext;

export function getGlobalContext() {
  if (!globalContext) {
    globalContext = ipcRenderer.sendSync(_IpcRendererEvt.GET_GLOBAL_DATA);
  }
  return globalContext;
}

const mod = {
  getGlobalContext,
};

getGlobalContext();
contextBridge.exposeInMainWorld("@shared/global-context", mod);
