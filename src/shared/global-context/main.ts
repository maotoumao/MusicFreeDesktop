import { BrowserWindow, app, ipcMain } from "electron";
import { IpcRendererEvt } from "./internal/common";

declare const WORKER_DOWNLOADER_WEBPACK_ENTRY: string;
declare const LOCAL_FILE_WATCHER_WEBPACK_ENTRY: string;
declare const DB_WEBPACK_ENTRY: string;

export function setupGlobalContext() {
  ipcMain.on(IpcRendererEvt.GET_GLOBAL_DATA, (evt) => {
    evt.returnValue = {
      appVersion: app.getVersion(),
      workersPath: {
        downloader: WORKER_DOWNLOADER_WEBPACK_ENTRY,
        localFileWatcher: LOCAL_FILE_WATCHER_WEBPACK_ENTRY,
        db: DB_WEBPACK_ENTRY,
      },
      appPath: {
        downloads: app.getPath("downloads"),
        temp: app.getPath("temp"),
        userData: app.getPath("userData"),
      },
      platform: process.platform,
    };
  });
}
