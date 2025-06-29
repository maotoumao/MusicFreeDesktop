// See the Electron documentation for details on how to use preload scripts:
import "./common-preload";
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import "@shared/service-manager/preload";
import "@shared/plugin-manager/preload";
import "@shared/message-bus/preload/main";
import "@shared/short-cut/preload";
import "@shared/database/preload";