import { app, ipcMain } from "electron";
import path from "path";
import { IpcRendererEvt } from "./internal/common";

export function setupAppDB() {
  ipcMain.handle(IpcRendererEvt.GET_DB_PATH, () => {
    return path.resolve(app.getPath("userData"), "./database.db");
  });
}
