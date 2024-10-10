import { nativeImage } from "electron";
import { getMainWindow } from "../window";
import { PlayerState } from "@/common/constant";
import { t } from "@/shared/i18n/main";
import { sendCommand } from "@/shared/player-command-sync/main";
import getResourcePath from "@/utils/main/get-resource-path";

export default function (isPlaying?: boolean) {
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }

  mainWindow.setThumbarButtons([
    {
      icon: nativeImage.createFromPath(getResourcePath("skip-left.png")),
      tooltip: t("main.previous_music"),
      click() {
        sendCommand("SkipToPrevious");
      },
    },
    {
      icon: nativeImage.createFromPath(
        getResourcePath(isPlaying ? "pause.png" : "play.png")
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
      icon: nativeImage.createFromPath(getResourcePath("skip-right.png")),
      tooltip: t("main.next_music"),
      click() {
        sendCommand("SkipToNext");
      },
    },
  ]);
}
