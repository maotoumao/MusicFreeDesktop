import { ipcMainHandle, ipcMainOn } from "@/common/ipc-util/main";
import { getMainWindow } from "../window";
import { app, dialog, net, shell } from "electron";
import { currentMusicInfoStore } from "../store/current-music";
import { PlayerState } from "@/renderer/core/track-player/enum";
import { setupTrayMenu } from "../tray";
import axios from "axios";
import { compare } from "compare-versions";
import { getPluginByMedia } from "../core/plugin-manager";
import { encodeUrlHeaders } from "@/common/normalize-util";

export default function setupIpcMain() {
  ipcMainOn("min-window", ({ skipTaskBar }) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (skipTaskBar) {
        mainWindow.hide();
        mainWindow.setSkipTaskbar(true);
      }
      mainWindow.minimize();
    }
  });

  ipcMainOn("open-url", (url) => {
    shell.openExternal(url);
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

  ipcMainOn("sync-current-music", (musicItem) => {
    currentMusicInfoStore.setValue((prev) => ({
      ...prev,
      currentMusic: musicItem ?? null,
    }));
    setupTrayMenu();
  });

  ipcMainOn("sync-current-playing-state", (playerState) => {
    currentMusicInfoStore.setValue((prev) => ({
      ...prev,
      currentPlayerState: playerState ?? PlayerState.None,
    }));
    setupTrayMenu();
  });

  ipcMainOn("sync-current-repeat-mode", (repeatMode) => {
    currentMusicInfoStore.setValue((prev) => ({
      ...prev,
      currentRepeatMode: repeatMode,
    }));
    setupTrayMenu();
  });


  /** APP更新 */
  const updateSources = [
    "https://gitee.com/maotoumao/MusicFree/raw/master/release/version.json",
    "https://raw.githubusercontent.com/maotoumao/MusicFree/master/release/version.json",
  ];
  ipcMainHandle("check-update", async () => {
    const currentVersion = app.getVersion();
    const updateInfo: ICommon.IUpdateInfo = {
      version: currentVersion,
    };
    for (let i = 0; i < updateSources.length; ++i) {
      try {
        const rawInfo = (await axios.get(updateSources[i])).data;
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

  /** 下载音乐 */
  ipcMainOn('download-media', async ({mediaItem}) => {
    const mainWindow = getMainWindow();
    if(!mainWindow) {
      return;
    }
    try {
      const mediaSource = await getPluginByMedia(mediaItem)?.methods?.getMediaSource(mediaItem);
      const headers = mediaSource.headers ?? {};
      if(mediaSource.userAgent) {
        headers['user-agent'] = mediaSource.userAgent;
      }
      const url = encodeUrlHeaders(mediaSource.url, headers);
      mainWindow.webContents.downloadURL(url);
    } catch {

    }
  })

}
