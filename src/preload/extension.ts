import { contextBridge } from "electron";
import extPort from "./internal/ext-port";

import "./common-preload";


contextBridge.exposeInMainWorld("extPort", extPort);
