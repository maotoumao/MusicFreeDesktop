import { app, BrowserWindow, globalShortcut } from "electron";
import {
  createLyricWindow,
  createMainWindow,
  getLyricWindow,
  getMainWindow,
  showMainWindow,
} from "./window";
import setupIpcMain from "./ipc";
import { setupPluginManager } from "./core/plugin-manager";
import {
  getAppConfigPath,
  setAppConfigPath,
  setupMainAppConfig,
} from "@/common/app-config/main";
import { setupTray } from "./tray";
import { setupLocalMusicManager } from "./core/local-music-manager";
import { setupGlobalShortCut } from "./core/global-short-cut";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require("electron-squirrel-startup")) {
//   app.quit();
// }

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createMainWindow);

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
app.whenReady().then(async () => {
  setupIpcMain();
  await setupMainAppConfig();
  setupPluginManager();
  setupTray();
  setupLocalMusicManager();
  bootstrap();
  setupGlobalShortCut();
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
}
