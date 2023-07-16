import { app, BrowserWindow, ipcRenderer } from "electron";
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
import fs from "fs/promises";
import path from "path";
import { getResPath } from "./util";
import { IAppConfig, IThemePack } from "@/common/app-config/type";
import { addFileScheme, addTailSlash } from "@/common/file-util";

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
app.whenReady().then(async () => {
  setupIpcMain();
  await setupMainAppConfig();
  setupPluginManager();
  setupTray();
  setupLocalMusicManager();
  bootstrap();
});

async function bootstrap() {
  const downloadPath = await getAppConfigPath("download.path");
  if (!downloadPath) {
    setAppConfigPath("download.path", app.getPath("downloads"));
  }

  // 初始化主题包
  const themepackDir = getResPath("themepack");
  const themepackPaths = await fs.readdir(themepackDir);
  // 读取所有的文件夹
  const validThemePacks: string[] = [];
  for (const themepackPath of themepackPaths) {
    const packContent = await fs.readdir(
      path.resolve(themepackDir, themepackPath)
    );
    if (
      packContent.includes("config.json") &&
      packContent.includes("index.css")
    ) {
      validThemePacks.push(themepackPath);
    }
  }
  // 构造
  const parsedThemePacks: IThemePack[] = [];
  for (let i = 0; i < validThemePacks.length; ++i) {
    try {
      // 读取json
      const themepackPath = path.resolve(themepackDir, validThemePacks[i]);
      const jsonData = JSON.parse(await fs.readFile(path.resolve(themepackPath, "config.json"), 'utf-8'));
      console.log(jsonData);
      const themePack: IThemePack = {
        name: jsonData.name,
        preview: jsonData.preview?.startsWith?.("#")
          ? jsonData.preview
          : jsonData.preview?.replace?.("@/", addTailSlash(addFileScheme(themepackPath))),
        path: themepackPath,
      };
      parsedThemePacks.push(themePack);
    } catch(e) {
      console.log("eeee", e);
    }
  }
  setAppConfigPath('theme.themePacks', parsedThemePacks);

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
