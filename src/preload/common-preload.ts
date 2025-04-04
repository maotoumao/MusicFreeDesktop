// See the Electron documentation for details on how to use preload scripts:
import { contextBridge } from "electron";
import path from "path";
import "electron-log/preload";
import "@shared/i18n/preload";
import "@shared/global-context/preload";
import "@shared/themepack/preload";
import "@shared/app-config/preload";
import "@shared/utils/preload";

// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

contextBridge.exposeInMainWorld("path", path);
