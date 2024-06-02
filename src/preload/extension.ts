import { contextBridge } from "electron";
// import extPort from "./internal/ext-port";

import "./common-preload";

import "@/shared/message-hub/preload/extension";

// contextBridge.exposeInMainWorld("extPort", extPort);
