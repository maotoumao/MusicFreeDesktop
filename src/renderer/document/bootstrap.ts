import { localPluginHash, supportLocalMediaType } from "@/common/constant";
import MusicSheet from "../core/music-sheet";
import {
  callPluginDelegateMethod,
  registerPluginEvents,
} from "../core/plugin-delegate";
import trackPlayer from "../core/track-player";
import rendererAppConfig from "@/common/app-config/renderer";
import localMusic from "../core/local-music";
import { setupLocalShortCut } from "../core/shortcut";
import { setAutoFreeze } from "immer";
import Evt from "../core/events";
import { ipcRendererInvoke } from "@/common/ipc-util/renderer";

import * as Comlink from 'comlink';
import Downloader from "../core/downloader";

setAutoFreeze(false);

export default async function () {
  await Promise.all([
    rendererAppConfig.setupRendererAppConfig(),
    registerPluginEvents(),
    MusicSheet.setupSheets(),
    trackPlayer.setupPlayer(),
    localMusic.setupLocalMusic(),
  ]);
  await window.themepack.setupThemePacks();
  setupLocalShortCut();
  dropHandler();
  clearDefaultBehavior();
  setupEvents();
  await Downloader.setupDownloader();

}

function dropHandler() {
  document.addEventListener("drop", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const validMusicList: IMusic.IMusicItem[] = [];
    for (const f of event.dataTransfer.files) {
      if (f.type === "") {
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
    const enableDesktopLyric = rendererAppConfig.getAppConfigPath(
      "lyric.enableDesktopLyric"
    );

    ipcRendererInvoke("set-lyric-window", !enableDesktopLyric);
    rendererAppConfig.setAppConfigPath(
      "lyric.enableDesktopLyric",
      !enableDesktopLyric
    );
  });
}
