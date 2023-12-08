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

let tray: Tray | null = null;

if (process.platform === "darwin") {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.getName(),
        submenu: [
          {
            label: "关于",
            role: "about",
          },
          {
            label: "退出",
            click() {
              app.quit();
            },
          },
        ],
      },
      {
        label: "编辑",
        submenu: [
          {
            label: "撤销",
            accelerator: "Command+Z",
            role: "undo",
          },
          { label: "恢复", accelerator: "Shift+Command+Z", role: "redo" },
          { type: "separator" },
          { label: "剪切", accelerator: "Command+X", role: "cut" },
          { label: "复制", accelerator: "Command+C", role: "copy" },
          { label: "粘贴", accelerator: "Command+V", role: "paste" },
          { type: "separator" },
          { label: "全选", accelerator: "Command+A", role: "selectAll" },
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
      `${currentMusic.title ?? "未知音乐"}${
        currentMusic.artist ? ` - ${currentMusic.artist}` : ""
      }`
    );
  } else {
    tray.setToolTip("MusicFree");
  }
  if (currentMusic) {
    const fullName = `${currentMusic.title ?? "未知音乐"}${
      currentMusic.artist ? ` - ${currentMusic.artist}` : ""
    }`;
    ctxMenu.push(
      {
        label: fullName.length > 12 ? fullName.slice(0, 12) + "..." : fullName,
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
    label: "播放模式",
    type: "submenu",
    submenu: Menu.buildFromTemplate([
      {
        label: "单曲循环",
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
        label: "顺序播放",
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
        label: "随机播放",
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
    label: "设置",
    click() {
      showMainWindow();
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
