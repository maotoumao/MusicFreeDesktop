import { app, BrowserWindow, globalShortcut } from "electron";
import {
  createLyricWindow,
  createMainWindow,
  getLyricWindow,
  getMainWindow,
  showMainWindow,
} from "./window";
import setupIpcMain, { handleProxy } from "./ipc";
import { setupPluginManager } from "./core/plugin-manager";
import { setupTray, setupTrayMenu } from "./tray";
import { setupGlobalShortCut } from "./core/global-short-cut";
import fs from "fs";
import path from "path";
import { setAutoFreeze } from "immer";
import setThumbbarBtns from "./utils/set-thumbbar-btns";
import { currentMusicInfoStore } from "./store/current-music";
// TODO: Main process should not depends on files in renderer process
import { PlayerState } from "@/renderer/core/track-player/enum";

import {
  getAppConfigPath,
  getAppConfigPathSync,
  setAppConfigPath,
  setupMainAppConfig,
} from "@/shared/app-config/main";
import { setupGlobalContext } from "@/shared/global-context/main";
import { setupI18n } from "@/shared/i18n/main";
import {
  createMiniModeWindow,
  getMinimodeWindow,
  showMinimodeWindow,
} from "./window/minimode-window";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require("electron-squirrel-startup")) {
//   app.quit();
// }

// portable
if (process.platform === "win32") {
  try {
    const appPath = app.getPath("exe");
    const portablePath = path.resolve(appPath, "../portable");
    const portableFolderStat = fs.statSync(portablePath);
    if (portableFolderStat.isDirectory()) {
      const appPathNames = ["appData", "userData"];
      appPathNames.forEach((it) => {
        app.setPath(it, path.resolve(portablePath, it));
      });
    }
  } catch (e) {
    // console.log(e)
  }
}

setAutoFreeze(false);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

app.on("second-instance", () => {
  if (getMainWindow()) {
    showMainWindow();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
app.whenReady().then(async () => {
  await Promise.allSettled([setupGlobalContext(), setupMainAppConfig()]);
  setupI18n({
    getDefaultLang() {
      return getAppConfigPathSync("normal.language");
    },
    onLanguageChanged(lang) {
      setAppConfigPath("normal.language", lang);
      setupTrayMenu();
      if (process.platform === "win32") {
        setThumbbarBtns(
          currentMusicInfoStore.getValue().currentPlayerState ===
            PlayerState.Playing
        );
      }
    },
  });
  setupIpcMain();
  setupPluginManager();
  setupTray();
  bootstrap();
  setupGlobalShortCut();
  createMainWindow();
});

async function bootstrap() {
  const downloadPath = await getAppConfigPath("download.path");
  if (!downloadPath) {
    setAppConfigPath("download.path", app.getPath("downloads"));
  }

  /** 一些初始化设置 */
  // 初始化桌面歌词
  getAppConfigPath("lyric.enableDesktopLyric").then((result) => {
    if (result) {
      if (!getLyricWindow()) {
        createLyricWindow();
      }
    }
  });

  getAppConfigPath("private.minimode").then((enabled) => {
    if (enabled) {
      if (!getMinimodeWindow()) {
        showMinimodeWindow();
      }
    }
  });

  getAppConfigPath("network.proxy").then((result) => {
    if (result) {
      handleProxy(result);
    }
  });
}
