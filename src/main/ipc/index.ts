import {ipcMainHandle, ipcMainOn} from "@/shared/ipc/main";
import {app, dialog, shell} from "electron";
import fs from "fs/promises";
import axios from "axios";
import {compare} from "compare-versions";
import AppConfig from "@shared/app-config/main";
import {appUpdateSources} from "@/common/constant";
import windowManager from "@main/window-manager";

export default function setupIpcMain() {
    ipcMainOn("min-window", ({skipTaskBar}) => {
        const mainWindow = windowManager.mainWindow;
        if (mainWindow) {
            if (skipTaskBar) {
                mainWindow.hide();
                mainWindow.setSkipTaskbar(true);
            } else {
                mainWindow.minimize();
            }
        }
    });

    ipcMainOn("open-url", (url) => {
        shell.openExternal(url);
    });

    ipcMainOn("open-path", (path) => {
        shell.openPath(path);
    });

    ipcMainHandle("show-item-in-folder", async (fullPath: string) => {
        try {
            await fs.stat(fullPath);
            shell.showItemInFolder(fullPath);
            return true;
        } catch {
            return false;
        }
    });

    ipcMainHandle("show-open-dialog", (options) => {
        const mainWindow = windowManager.mainWindow;
        if (!mainWindow) {
            throw new Error("Invalid Window");
        }
        return dialog.showOpenDialog(options);
    });

    ipcMainHandle("show-save-dialog", (options) => {
        const mainWindow = windowManager.mainWindow;
        if (!mainWindow) {
            throw new Error("Invalid Window");
        }
        return dialog.showSaveDialog(options);
    });

    ipcMainOn("exit-app", () => {
        app.exit(0);
    });


    ipcMainHandle("app-get-path", (pathName) => {
        return app.getPath(pathName as any);
    });

    /** APP更新 */
    ipcMainHandle("check-update", async () => {
        const currentVersion = app.getVersion();
        const updateInfo: ICommon.IUpdateInfo = {
            version: currentVersion,
        };
        for (let i = 0; i < appUpdateSources.length; ++i) {
            try {
                const rawInfo = (await axios.get(appUpdateSources[i])).data;
                if (compare(rawInfo.version, currentVersion, ">")) {
                    updateInfo.update = rawInfo;
                    return updateInfo;
                }
            } catch {
                continue;
            }
        }
        return updateInfo;
    });

    ipcMainHandle("set-lyric-window", (enabled) => {
        setLyricWindow(enabled);
    });

    ipcMainOn("clear-cache", () => {
        const mainWindow = windowManager.mainWindow;
        if (mainWindow) {
            mainWindow.webContents.session.clearCache?.();
        }
    });

    ipcMainHandle("get-cache-size", async () => {
        const mainWindow = windowManager.mainWindow;
        if (mainWindow) {
            return await mainWindow.webContents.session.getCacheSize();
        }

        return NaN;
    });

    ipcMainOn("set-minimode", (enabled) => {
        if (enabled && !windowManager.miniModeWindow) {
            windowManager.showMiniModeWindow();
        } else if (!enabled) {
            windowManager.closeMiniModeWindow();
        }
    });

    ipcMainOn("show-mainwindow", () => {
        windowManager.showMainWindow();
    });
    // ipcMainOn("send-to-lyric-window", (data) => {
    //   const lyricWindow = getLyricWindow();
    //   if (!lyricWindow) {
    //     return;
    //   }
    //   currentMusicInfoStore.setValue((prev) => ({
    //     ...prev,
    //     lrc: data.lrc,
    //   }));
    //   // syncExtensionData({
    //   //   lrc: data.lrc,
    //   // });
    // });

    ipcMainOn("set-desktop-lyric-lock", (lockState) => {
        setDesktopLyricLock(lockState);
    });

    ipcMainOn("ignore-mouse-event", async (data) => {
        const targetWindow =
            data.window === "main" ? windowManager.mainWindow : windowManager.lyricWindow;
        if (!targetWindow) {
            return;
        }
        targetWindow.setIgnoreMouseEvents(data.ignore, {
            forward: true,
        });
    });
}


export async function setLyricWindow(enabled: boolean) {
    if (enabled) {
        windowManager.showLyricWindow();
    } else {
        windowManager.closeLyricWindow();
    }
}

export async function setDesktopLyricLock(lockState: boolean) {
    AppConfig.setConfig({
        "lyric.lockLyric": lockState
    });

    const lyricWindow = windowManager.lyricWindow;

    if (!lyricWindow) {
        return;
    }
    if (lockState) {
        lyricWindow.setIgnoreMouseEvents(true, {
            forward: true,
        });
    } else {
        lyricWindow.setIgnoreMouseEvents(false);
    }
}
