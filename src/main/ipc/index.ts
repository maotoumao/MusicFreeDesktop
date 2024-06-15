import { ipcMainHandle, ipcMainOn } from "@/shared/ipc/main";
import {
  closeLyricWindow,
  createLyricWindow,
  getLyricWindow,
  getMainWindow,
  showMainWindow,
} from "../window";
import { app, dialog, shell } from "electron";
import fs from "fs/promises";
import { currentMusicInfoStore } from "../store/current-music";
import { PlayerState } from "@/renderer/core/track-player/enum";
import { setTrayTitle, setupTrayMenu } from "../tray";
import axios from "axios";
import { compare } from "compare-versions";
import {
  getAppConfigPathSync,
  setAppConfigPath,
} from "@/shared/app-config/main";
// import { getExtensionWindow, syncExtensionData } from "../core/extensions";
import setThumbImg from "../utils/set-thumb-img";
import setThumbbarBtns from "../utils/set-thumbbar-btns";
import { HttpsProxyAgent } from "https-proxy-agent";
import { IAppConfig } from "@/shared/app-config/type";
import {
  closeMinimodeWindow,
  createMiniModeWindow,
  getMinimodeWindow,
  showMinimodeWindow,
} from "../window/minimode-window";
import { appUpdateSources } from "@/common/constant";

export default function setupIpcMain() {
  ipcMainOn("min-window", ({ skipTaskBar }) => {
    const mainWindow = getMainWindow();
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
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      throw new Error("Invalid Window");
    }
    return dialog.showOpenDialog(options);
  });

  ipcMainHandle("show-save-dialog", (options) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      throw new Error("Invalid Window");
    }
    return dialog.showSaveDialog(options);
  });

  ipcMainOn("exit-app", () => {
    app.exit(0);
  });

  const thumbStyle = getAppConfigPathSync("normal.taskbarThumb");
  ipcMainOn("sync-current-music", (musicItem) => {
    currentMusicInfoStore.setValue((prev) => ({
      ...prev,
      currentMusic: musicItem ?? null,
    }));
    // syncExtensionData({
    //   currentMusic: musicItem,
    // });
    setupTrayMenu();
    // 设置当前缩略图
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (process.platform === "win32" && thumbStyle === "artwork") {
        const hwnd = mainWindow.getNativeWindowHandle().readBigUInt64LE(0);
        setThumbImg(musicItem?.artwork, hwnd);
      }
      if (musicItem) {
        mainWindow.setTitle(
          musicItem.title + (musicItem.artist ? ` - ${musicItem.artist}` : "")
        );
      } else {
        mainWindow.setTitle(app.name);
      }
    }
  });

  ipcMainOn("sync-current-playing-state", (playerState) => {
    currentMusicInfoStore.setValue((prev) => ({
      ...prev,
      currentPlayerState: playerState ?? PlayerState.None,
    }));
    // syncExtensionData({
    //   playerState: playerState ?? PlayerState.None,
    // });
    setupTrayMenu();
    if (process.platform === "win32") {
      setThumbbarBtns(playerState === PlayerState.Playing);
    }
  });

  ipcMainOn("sync-current-repeat-mode", (repeatMode) => {
    currentMusicInfoStore.setValue((prev) => ({
      ...prev,
      currentRepeatMode: repeatMode,
    }));
    setupTrayMenu();
  });

  ipcMainOn("sync-current-lyric", (lrc) => {
    if (getAppConfigPathSync("lyric.enableStatusBarLyric")) {
      setTrayTitle(lrc);
    } else {
      setTrayTitle("");
    }
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
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.session.clearCache?.();
    }
  });

  ipcMainHandle("get-cache-size", async () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      return await mainWindow.webContents.session.getCacheSize();
    }

    return NaN;
  });

  ipcMainOn("set-minimode", (enabled) => {
    if (enabled && !getMinimodeWindow()) {
      showMinimodeWindow();
      setAppConfigPath("private.minimode", true);
    } else if (!enabled) {
      closeMinimodeWindow();
      setAppConfigPath("private.minimode", false);
    }
  });

  ipcMainOn("show-mainwindow", () => {
    showMainWindow();
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
      data.window === "main" ? getMainWindow() : getLyricWindow();
    if (!targetWindow) {
      return;
    }
    targetWindow.setIgnoreMouseEvents(data.ignore, {
      forward: true,
    });
  });

  /** 设置代理 */
  ipcMainOn("set-proxy", async (data) => {
    handleProxy(data);
    setAppConfigPath("network.proxy", data);
  });
}

export async function handleProxy(data: IAppConfig["network"]["proxy"]) {
  try {
    if (!data.enabled) {
      axios.defaults.httpAgent = undefined;
      axios.defaults.httpsAgent = undefined;
    } else if (data.host) {
      const proxyUrl = new URL(data.host);
      proxyUrl.port = data.port;
      proxyUrl.username = data.username;
      proxyUrl.password = data.password;
      const agent = new HttpsProxyAgent(proxyUrl);

      axios.defaults.httpAgent = agent;
      axios.defaults.httpsAgent = agent;
    } else {
      throw new Error("Unknown Host");
    }
  } catch (e) {
    axios.defaults.httpAgent = undefined;
    axios.defaults.httpsAgent = undefined;
  }
}

export async function setLyricWindow(enabled: boolean) {
  if (enabled) {
    let lyricWindow = getLyricWindow();
    if (!lyricWindow) {
      lyricWindow = createLyricWindow();
    }
  } else {
    closeLyricWindow();
  }
  await setAppConfigPath("lyric.enableDesktopLyric", enabled);
  setupTrayMenu();
}

export async function setDesktopLyricLock(lockState: boolean) {
  const result = await setAppConfigPath("lyric.lockLyric", lockState);

  if (result) {
    const lyricWindow = getLyricWindow();

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
  setupTrayMenu();
}
