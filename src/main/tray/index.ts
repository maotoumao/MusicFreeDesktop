import {
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  Tray,
  app,
  nativeImage,
} from "electron";
import { showMainWindow } from "../window";
import { currentMusicInfoStore } from "../store/current-music";
import { PlayerState, RepeatMode } from "@/renderer/core/track-player/enum";
import { ipcMainSendMainWindow } from "@/common/ipc-util/main";
import { getResPath } from "../utils/get-res-path";
import { getAppConfigPath } from "@/common/app-config/main";
import { setDesktopLyricLock, setLyricWindow } from "../ipc";
import i18n from "@/common/i18n";

let tray: Tray | null = null;

const {t} = i18n;

if (process.platform === "darwin") {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.getName(),
        submenu: [
          {
            label: t("common.about"),
            role: "about",
          },
          {
            label: t("common.exit"),
            click() {
              app.quit();
            },
          },
        ],
      },
      {
        label: t("common.edit"),
        submenu: [
          {
            label: t("common.undo"),
            accelerator: "Command+Z",
            role: "undo",
          },
          { label: t("common.redo"), accelerator: "Shift+Command+Z", role: "redo" },
          { type: "separator" },
          { label: t("common.cut"), accelerator: "Command+X", role: "cut" },
          { label: t("common.copy"), accelerator: "Command+C", role: "copy" },
          { label: t("common.cut"), accelerator: "Command+V", role: "paste" },
          { type: "separator" },
          { label: t("common.select_all"), accelerator: "Command+A", role: "selectAll" },
        ],
      },
    ])
  );
} else {
  Menu.setApplicationMenu(null);
}

export function setupTray() {
  tray = new Tray(
    nativeImage.createFromPath(getResPath("logo.png")).resize({
      width: 32,
      height: 32,
    })
  );

  tray.on("double-click", () => {
    showMainWindow();
  });

  setupTrayMenu();
}

function openMusicDetail() {
  showMainWindow();
  ipcMainSendMainWindow("navigate", "evt://SHOW_MUSIC_DETAIL");
}

export async function setupTrayMenu() {
  if (!tray) {
    return;
  }

  const ctxMenu: Array<MenuItemConstructorOptions | MenuItem> = [];

  /********* 音乐信息 **********/
  const { currentMusic, currentPlayerState, currentRepeatMode } =
    currentMusicInfoStore.getValue();
  // 更新一下tooltip
  if (currentMusic) {
    tray.setToolTip(
      `${currentMusic.title ?? t("media.unknown_title")}${
        currentMusic.artist ? ` - ${currentMusic.artist}` : ""
      }`
    );
  } else {
    tray.setToolTip("MusicFree");
  }
  if (currentMusic) {
    const fullName = `${currentMusic.title ?? t("media.unknown_title")}${
      currentMusic.artist ? ` - ${currentMusic.artist}` : ""
    }`;
    ctxMenu.push(
      {
        label: fullName.length > 12 ? fullName.slice(0, 12) + "..." : fullName,
        click: openMusicDetail,
      },
      {
        label: `${t("media.media_platform")}: ${currentMusic.platform}`,
        click: openMusicDetail,
      }
    );
  } else {
    ctxMenu.push({
      label: "当前无正在播放的音乐",
      enabled: false,
    });
  }

  ctxMenu.push(
    {
      label: currentMusic
        ? currentPlayerState === PlayerState.Playing
          ? t("media.music_state_pause")
          : t("media.music_state_play")
        : t("media.music_state_play_or_pause"),
      enabled: !!currentMusic,
      click() {
        if (!currentMusic) {
          return;
        }
        ipcMainSendMainWindow("player-cmd", {
          cmd: "set-player-state",
          payload:
            currentPlayerState === PlayerState.Playing
              ? PlayerState.Paused
              : PlayerState.Playing,
        });
      },
    },
    {
      label: "上一首",
      enabled: !!currentMusic,
      click() {
        ipcMainSendMainWindow("player-cmd", {
          cmd: "skip-prev",
        });
      },
    },
    {
      label: "下一首",
      enabled: !!currentMusic,
      click() {
        ipcMainSendMainWindow("player-cmd", {
          cmd: "skip-next",
        });
      },
    }
  );

  ctxMenu.push({
    label: t("media.music_repeat_mode"),
    type: "submenu",
    submenu: Menu.buildFromTemplate([
      {
        label: t("media.music_repeat_mode_loop"),
        id: RepeatMode.Loop,
        type: "radio",
        checked: currentRepeatMode === RepeatMode.Loop,
        click() {
          ipcMainSendMainWindow("player-cmd", {
            cmd: "set-repeat-mode",
            payload: RepeatMode.Loop,
          });
        },
      },
      {
        label: t("media.music_repeat_mode_queue"),
        id: RepeatMode.Queue,
        type: "radio",
        checked: currentRepeatMode === RepeatMode.Queue,
        click() {
          ipcMainSendMainWindow("player-cmd", {
            cmd: "set-repeat-mode",
            payload: RepeatMode.Queue,
          });
        },
      },
      {
        label: t("media.music_repeat_mode_shuffle"),
        id: RepeatMode.Shuffle,
        type: "radio",
        checked: currentRepeatMode === RepeatMode.Shuffle,
        click() {
          ipcMainSendMainWindow("player-cmd", {
            cmd: "set-repeat-mode",
            payload: RepeatMode.Shuffle,
          });
        },
      },
    ]),
  });

  ctxMenu.push({
    type: "separator",
  });
  /** 桌面歌词 */
  const lyricConfig = await getAppConfigPath("lyric");
  if (lyricConfig?.enableDesktopLyric) {
    ctxMenu.push({
      label: "关闭桌面歌词",
      click() {
        setLyricWindow(false);
      },
    });
  } else {
    ctxMenu.push({
      label: "开启桌面歌词",
      click() {
        setLyricWindow(true);
      },
    });
  }

  if (lyricConfig?.lockLyric) {
    ctxMenu.push({
      label: "解锁桌面歌词",
      click() {
        setDesktopLyricLock(false);
      },
    });
  } else {
    ctxMenu.push({
      label: "锁定桌面歌词",
      click() {
        setDesktopLyricLock(true);
      },
    });
  }

  ctxMenu.push({
    type: "separator",
  });
  /********* 其他操作 **********/
  ctxMenu.push({
    label: t("app_header.settings"),
    click() {
      showMainWindow();
      ipcMainSendMainWindow("navigate", "/main/setting");
    },
  });
  ctxMenu.push({
    label: t("common.exit"),
    role: "quit",
    click() {
      app.exit(0);
    },
  });

  tray.setContextMenu(Menu.buildFromTemplate(ctxMenu));
}

export function setTrayTitle(str: string) {
  if (!str || !str.length) {
    tray.setTitle("");
  }
  if (str.length > 7) {
    tray?.setTitle(" " + str.slice(0) + "...");
  } else {
    tray?.setTitle(" " + str);
  }
}
