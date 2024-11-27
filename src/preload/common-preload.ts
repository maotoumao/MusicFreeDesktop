// See the Electron documentation for details on how to use preload scripts:
import { contextBridge } from "electron";
import ipcRendererDelegate from "./internal/ipc-renderer-delegate";
import path from "path";
import "electron-log/preload";
import "@shared/i18n/preload";
import "@shared/global-context/preload";
import "@shared/app-db/preload";
import "@shared/themepack/preload";
import "@/providers/app-config/preload";
import "@shared/utils/preload";

// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

contextBridge.exposeInMainWorld("ipcRenderer", ipcRendererDelegate);
contextBridge.exposeInMainWorld("path", path);
