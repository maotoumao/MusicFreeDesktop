// See the Electron documentation for details on how to use preload scripts:

import { contextBridge } from "electron";
import ipcRendererDelegate from "./internal/ipc-renderer-delegate";
import fsDelegate from "./internal/fs-delegate";
import themepack from "./internal/themepack";
import path from 'path';
import { rimraf } from "rimraf";
import extPort from "./internal/ext-port";
import utils from './internal/utils';
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts




contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererDelegate);
contextBridge.exposeInMainWorld('fs', fsDelegate);
contextBridge.exposeInMainWorld('themepack', themepack);
contextBridge.exposeInMainWorld('path', path);
contextBridge.exposeInMainWorld('rimraf', rimraf)
contextBridge.exposeInMainWorld('extPort', extPort);
contextBridge.exposeInMainWorld('utils', utils);
