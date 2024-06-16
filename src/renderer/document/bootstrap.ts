import { localPluginHash, supportLocalMediaType } from "@/common/constant";
import MusicSheet from "../core/music-sheet";
import {
  callPluginDelegateMethod,
  registerPluginEvents,
} from "../core/plugin-delegate";
import trackPlayer from "../core/track-player";
import localMusic from "../core/local-music";
import { setupLocalShortCut } from "../core/shortcut";
import { setAutoFreeze } from "immer";
import Evt from "../core/events";
import { ipcRendererInvoke, ipcRendererSend } from "@/shared/ipc/renderer";

import Downloader from "../core/downloader";
import {
  getAppConfigPath,
  setAppConfigPath,
  setupRendererAppConfig,
} from "@/shared/app-config/renderer";
import { setupI18n } from "@/shared/i18n/renderer";
import {
  setupCommandHandler,
  setupPlayerSyncHandler,
} from "../core/command-handler";
import ThemePack from "@/shared/themepack/renderer";
import {
  addToRecentlyPlaylist,
  setupRecentlyPlaylist,
} from "../core/recently-playlist";
import { TrackPlayerEvent } from "../core/track-player/enum";

setAutoFreeze(false);

export default async function () {
  await Promise.all([
    setupRendererAppConfig(),
    registerPluginEvents(),
    MusicSheet.frontend.setupMusicSheets(),
    trackPlayer.setupPlayer(),
  ]);
  setupCommandHandler();
  setupPlayerSyncHandler();
  await setupI18n();
  setupLocalShortCut();
  dropHandler();
  clearDefaultBehavior();
  setupEvents();
  setupDeviceChange();
  localMusic.setupLocalMusic();
  await Downloader.setupDownloader();
  setupRecentlyPlaylist();

  // 自动更新插件
  if (getAppConfigPath("plugin.autoUpdatePlugin")) {
    const lastUpdated = +(localStorage.getItem("pluginLastupdatedTime") || 0);
    const now = Date.now();
    if (Math.abs(now - lastUpdated) > 86400000) {
      localStorage.setItem("pluginLastupdatedTime", `${now}`);
      ipcRendererSend("update-all-plugins");
    }
  }
}

function dropHandler() {
  document.addEventListener("drop", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    console.log(event);

    const validMusicList: IMusic.IMusicItem[] = [];
    for (const f of event.dataTransfer.files) {
      if (f.type === "" && (await window.fs.isFolder(f.path))) {
        validMusicList.push(
          ...(await callPluginDelegateMethod(
            {
              hash: localPluginHash,
            },
            "importMusicSheet",
            f.path
          ))
        );
      } else if (
        supportLocalMediaType.some((postfix) => f.path.endsWith(postfix))
      ) {
        validMusicList.push(
          await callPluginDelegateMethod(
            {
              hash: localPluginHash,
            },
            "importMusicItem",
            f.path
          )
        );
      } else if (f.path.endsWith(".mftheme")) {
        // 主题包
        const themeConfig = await ThemePack.installThemePack(f.path);
        if (themeConfig) {
          await ThemePack.selectTheme(themeConfig);
        }
      }
    }
    if (validMusicList.length) {
      trackPlayer.playMusicWithReplaceQueue(validMusicList);
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}

function clearDefaultBehavior() {
  const killSpaceBar = function (evt: any) {
    // https://greasyfork.org/en/scripts/25035-disable-space-bar-scrolling/code
    const target = evt.target || {},
      isInput =
        "INPUT" == target.tagName ||
        "TEXTAREA" == target.tagName ||
        "SELECT" == target.tagName ||
        "EMBED" == target.tagName;

    // if we're an input or not a real target exit
    if (isInput || !target.tagName) return;

    // if we're a fake input like the comments exit
    if (
      target &&
      target.getAttribute &&
      target.getAttribute("role") === "textbox"
    )
      return;

    // ignore the space
    if (evt.keyCode === 32) {
      evt.preventDefault();
    }
  };

  document.addEventListener("keydown", killSpaceBar, false);
}

/** 设置事件 */
function setupEvents() {
  Evt.on("TOGGLE_DESKTOP_LYRIC", () => {
    const enableDesktopLyric = getAppConfigPath("lyric.enableDesktopLyric");

    ipcRendererInvoke("set-lyric-window", !enableDesktopLyric);
    setAppConfigPath("lyric.enableDesktopLyric", !enableDesktopLyric);
  });

  Evt.on("TOGGLE_LIKE", async (item) => {
    // 如果没有传入，就是当前播放的歌曲
    const realItem = item || trackPlayer.getCurrentMusic();
    if (MusicSheet.frontend.isFavoriteMusic(realItem)) {
      MusicSheet.frontend.removeMusicFromFavorite(realItem);
    } else {
      MusicSheet.frontend.addMusicToFavorite(realItem);
    }
  });

  // 最近播放
  trackPlayer.on(TrackPlayerEvent.MusicChanged, (musicItem) => {
    addToRecentlyPlaylist(musicItem);
  });
}

async function setupDeviceChange() {
  const getAudioDevices = async () =>
    await navigator.mediaDevices.enumerateDevices().catch(() => []);
  let devices = (await getAudioDevices()) || [];

  navigator.mediaDevices.ondevicechange = async (evt) => {
    const newDevices = await getAudioDevices();
    if (
      newDevices.length < devices.length &&
      getAppConfigPath("playMusic.whenDeviceRemoved") === "pause"
    ) {
      trackPlayer.pause();
    }
    devices = newDevices;
  };
}
