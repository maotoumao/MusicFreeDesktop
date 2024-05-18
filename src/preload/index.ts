// See the Electron documentation for details on how to use preload scripts:
import { contextBridge } from "electron";

import mainPort from "./internal/main-port";
import "./common-preload";
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

contextBridge.exposeInMainWorld("mainPort", mainPort);
