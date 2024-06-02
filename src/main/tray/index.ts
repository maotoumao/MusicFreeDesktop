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
import { ipcMainSendMainWindow } from "@/shared/ipc/main";
import { getResPath } from "../utils/get-res-path";
import { getAppConfigPath } from "@/shared/app-config/main";
import { setDesktopLyricLock, setLyricWindow } from "../ipc";
import { t } from "@/shared/i18n/main";
import { sendCommand } from "@/shared/player-command-sync/main";

let tray: Tray | null = null;

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
          {
            label: t("common.redo"),
            accelerator: "Shift+Command+Z",
            role: "redo",
          },
          { type: "separator" },
          { label: t("common.cut"), accelerator: "Command+X", role: "cut" },
          { label: t("common.copy"), accelerator: "Command+C", role: "copy" },
          { label: t("common.cut"), accelerator: "Command+V", role: "paste" },
          { type: "separator" },
          {
            label: t("common.select_all"),
            accelerator: "Command+A",
            role: "selectAll",
          },
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
      label: t("main.no_playing_music"),
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
        sendCommand(
          "SetPlayerState",
          currentPlayerState === PlayerState.Playing
            ? PlayerState.Paused
            : PlayerState.Playing
        );
      },
    },
    {
      label: t("main.previous_music"),
      enabled: !!currentMusic,
      click() {
        sendCommand("SkipToPrevious");
      },
    },
    {
      label: t("main.next_music"),
      enabled: !!currentMusic,
      click() {
        sendCommand("SkipToNext");
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
          sendCommand("SetRepeatMode", RepeatMode.Loop);
        },
      },
      {
        label: t("media.music_repeat_mode_queue"),
        id: RepeatMode.Queue,
        type: "radio",
        checked: currentRepeatMode === RepeatMode.Queue,
        click() {
          sendCommand("SetRepeatMode", RepeatMode.Queue);
        },
      },
      {
        label: t("media.music_repeat_mode_shuffle"),
        id: RepeatMode.Shuffle,
        type: "radio",
        checked: currentRepeatMode === RepeatMode.Shuffle,
        click() {
          sendCommand("SetRepeatMode", RepeatMode.Shuffle);
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
      label: t("main.close_desktop_lyric"),
      click() {
        setLyricWindow(false);
      },
    });
  } else {
    ctxMenu.push({
      label: t("main.open_desktop_lyric"),
      click() {
        setLyricWindow(true);
      },
    });
  }

  if (lyricConfig?.lockLyric) {
    ctxMenu.push({
      label: t("main.unlock_desktop_lyric"),
      click() {
        setDesktopLyricLock(false);
      },
    });
  } else {
    ctxMenu.push({
      label: t("main.lock_desktop_lyric"),
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
