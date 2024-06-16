import { nativeImage } from "electron";
import { getMainWindow } from "../window";
import { ipcMainSendMainWindow } from "@/shared/ipc/main";
import { getResPath } from "./get-res-path";
import { PlayerState } from "@/renderer/core/track-player/enum";
import { t } from "@/shared/i18n/main";
import { sendCommand } from "@/shared/player-command-sync/main";

export default function (isPlaying?: boolean) {
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }

  mainWindow.setThumbarButtons([
    {
      icon: nativeImage.createFromPath(getResPath("skip-left.png")),
      tooltip: t("main.previous_music"),
      click() {
        sendCommand("SkipToPrevious");
      },
    },
    {
      icon: nativeImage.createFromPath(
        getResPath(isPlaying ? "pause.png" : "play.png")
      ),
      tooltip: isPlaying
        ? t("media.music_state_pause")
        : t("media.music_state_play"),
      click() {
        sendCommand(
          "SetPlayerState",
          isPlaying ? PlayerState.Paused : PlayerState.Playing
        );
      },
    },
    {
      icon: nativeImage.createFromPath(getResPath("skip-right.png")),
      tooltip: t("main.next_music"),
      click() {
        sendCommand("SkipToNext");
      },
    },
  ]);
}
