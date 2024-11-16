import {app, BrowserWindow, dialog, ipcMain, shell} from "electron";
import {IWindowManager} from "@/types/main/window-manager";
import fs from "fs/promises";
import {appUpdateSources} from "@/common/constant";
import axios from "axios";
import {compare} from "compare-versions";

class Utils {
    private windowManager: IWindowManager;

    public setup(windowManager: IWindowManager) {
        this.windowManager = windowManager;

        this.setupAppUtil();
        this.setupWindowUtil();
        this.setupShellUtil();
        this.setupDialogUtil();
    }


    private setupAppUtil() {
        ipcMain.on("@shared/utils/exit-app", () => {
            app.exit(0);
        });

        ipcMain.handle("@shared/utils/app-get-path", (_, pathName) => {
            return app.getPath(pathName);
        });

        ipcMain.handle("@shared/utils/check-update", async () => {
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
                    // pass
                }
            }
            return updateInfo;
        });

        ipcMain.on("@shared/utils/clear-cache", () => {
            const mainWindow = this.windowManager.mainWindow;
            if (mainWindow) {
                mainWindow.webContents.session.clearCache?.();
            }
        });

        ipcMain.handle("@shared/utils/get-cache-size", async () => {
            const mainWindow = this.windowManager.mainWindow;
            if (mainWindow) {
                return mainWindow.webContents.session.getCacheSize?.();
            }
            return NaN;
        })
    }

    private setupWindowUtil() {
        ipcMain.on("@shared/utils/min-main-window", (_, {skipTaskBar}) => {
            const mainWindow = this.windowManager.mainWindow;
            if (mainWindow) {
                if (skipTaskBar) {
                    mainWindow.hide();
                    mainWindow.setSkipTaskbar(true);
                } else {
                    mainWindow.minimize();
                }
            }
        });

        ipcMain.on("@shared/utils/show-main-window", () => {
            this.windowManager.showMainWindow();
        })

        ipcMain.on("@shared/utils/set-lyric-window", (_, enabled) => {
            if (enabled) {
                this.windowManager.showLyricWindow();
            } else {
                this.windowManager.closeLyricWindow();
            }
        });

        ipcMain.on("@shared/utils/set-minimode-window", (_, enabled) => {
            if (enabled) {
                this.windowManager.showMiniModeWindow();
            } else {
                this.windowManager.closeMiniModeWindow();
            }
        });


        ipcMain.on("@shared/utils/ignore-mouse-event", (evt, ignore) => {
            const targetWindow = BrowserWindow.fromWebContents(evt.sender);
            if (!targetWindow) {
                return;
            }
            targetWindow.setIgnoreMouseEvents(ignore, {
                forward: true,
            });
        })

    }

    private setupShellUtil() {
        ipcMain.on("@shared/utils/open-url", (_, url) => {
            shell.openExternal(url);
        });

        ipcMain.on("@shared/utils/open-path", (_, path) => {
            shell.openPath(path);
        })

        ipcMain.handle("@shared/utils/show-item-in-folder", async (_, path) => {
            try {
                await fs.stat(path);
                shell.showItemInFolder(path);
                return true;
            } catch {
                return false;
            }
        })
    }

    private setupDialogUtil() {
        ipcMain.handle("@shared/utils/show-open-dialog", async (_, options) => {
            const mainWindow = this.windowManager.mainWindow;
            if (!mainWindow) {
                throw new Error("Invalid Window");
            }
            return dialog.showOpenDialog(options);
        });

        ipcMain.handle("@shared/utils/show-save-dialog", async (_, options) => {
            const mainWindow = this.windowManager.mainWindow;
            if (!mainWindow) {
                throw new Error("Invalid Window");
            }
            return dialog.showSaveDialog(options);
        });
    }

}


export default new Utils();
