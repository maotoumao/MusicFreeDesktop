import { nativeImage } from "electron";
import { getMainWindow } from "../window";
import { ipcMainSendMainWindow } from "@/shared/ipc/main";
import { getResPath } from "./get-res-path";
import { PlayerState } from "@/renderer/core/track-player/enum";

export default function (isPlaying?: boolean) {
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }

  mainWindow.setThumbarButtons([
    {
      icon: nativeImage.createFromPath(getResPath("skip-left.png")),
      tooltip: "上一首",
      click() {
        ipcMainSendMainWindow("player-cmd", {
          cmd: "skip-prev",
        });
      },
    },
    {
      icon: nativeImage.createFromPath(
        getResPath(isPlaying ? "pause.png" : "play.png")
      ),
      tooltip: isPlaying ? "暂停" : "播放",
      click() {
        ipcMainSendMainWindow("player-cmd", {
          cmd: "set-player-state",
          payload: isPlaying ? PlayerState.Paused : PlayerState.Playing,
        });
      },
    },
    {
      icon: nativeImage.createFromPath(getResPath("skip-right.png")),
      tooltip: "下一首",
      click() {
        ipcMainSendMainWindow("player-cmd", {
          cmd: "skip-next",
        });
      },
    },
  ]);
}
