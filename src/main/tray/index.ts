import {
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  Tray,
  app,
} from "electron";
import { showWindow } from "../window";
import { currentMusicInfoStore } from "../store/current-music";
import { PlayerState, RepeatMode } from "@/renderer/core/track-player/enum";
import { ipcMainSendMainWindow } from "@/common/ipc-util/main";
import { getResPath } from "../util";

let tray: Tray | null = null;

export function setupTray() {
  const iconPath = getResPath("logo.ico");

  tray = new Tray(iconPath);

  tray.on("double-click", () => {
    showWindow();
  });

  setupTrayMenu();
}

function openMusicDetail() {
  showWindow();
  ipcMainSendMainWindow("navigate", "evt://SHOW_MUSIC_DETAIL");
}

export function setupTrayMenu() {
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
      `${currentMusic.title ?? "未知音乐"}${
        currentMusic.artist ? ` - ${currentMusic.artist}` : ""
      }`
    );
  } else {
    tray.setToolTip("MusicFree");
  }
  if (currentMusic) {
    ctxMenu.push(
      {
        label: `${currentMusic.title ?? "未知音乐"}${
          currentMusic.artist ? ` - ${currentMusic.artist}` : ""
        }`,
        click: openMusicDetail,
      },
      {
        label: `来源: ${currentMusic.platform}`,
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
          ? "暂停"
          : "播放"
        : "播放/暂停",
      enabled: !!currentMusic,
      click() {
        if (!currentMusic) {
          return;
        }
        if (currentPlayerState === PlayerState.Playing) {
          ipcMainSendMainWindow("switch-music-state", PlayerState.Paused);
        } else if (currentPlayerState === PlayerState.Paused) {
          ipcMainSendMainWindow("switch-music-state", PlayerState.Playing);
        }
      },
    },
    {
      label: "上一首",
      enabled: !!currentMusic,
      click() {
        ipcMainSendMainWindow("skip-prev");
      },
    },
    {
      label: "下一首",
      enabled: !!currentMusic,
      click() {
        ipcMainSendMainWindow("skip-next");
      },
    }
  );

  ctxMenu.push({
    label: "播放模式",
    type: "submenu",
    submenu: Menu.buildFromTemplate([
      {
        label: "单曲循环",
        id: RepeatMode.Loop,
        type: "radio",
        checked: currentRepeatMode === RepeatMode.Loop,
        click() {
          ipcMainSendMainWindow("set-repeat-mode", RepeatMode.Loop);
        },
      },
      {
        label: "顺序播放",
        id: RepeatMode.Queue,
        type: "radio",
        checked: currentRepeatMode === RepeatMode.Queue,
        click() {
          ipcMainSendMainWindow("set-repeat-mode", RepeatMode.Queue);
        },
      },
      {
        label: "随机播放",
        id: RepeatMode.Shuffle,
        type: "radio",
        checked: currentRepeatMode === RepeatMode.Shuffle,
        click() {
          ipcMainSendMainWindow("set-repeat-mode", RepeatMode.Shuffle);
        },
      },
    ]),
  });

  ctxMenu.push({
    type: "separator",
  });
  /********* 其他操作 **********/
  ctxMenu.push({
    label: "设置",
    click() {
      showWindow();
      ipcMainSendMainWindow("navigate", "/main/setting");
    },
  });
  ctxMenu.push({
    label: "退出",
    role: "quit",
    click() {
      app.exit(0);
    },
  });

  tray.setContextMenu(Menu.buildFromTemplate(ctxMenu));
}
