// See the Electron documentation for details on how to use preload scripts:

import { app, contextBridge } from "electron";
import ipcRendererDelegate from "./internal/ipc-renderer-delegate";

// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts




contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererDelegate);