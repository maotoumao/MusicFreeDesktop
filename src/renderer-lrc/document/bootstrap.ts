import { ipcRendererOn, ipcRendererSend } from "@/common/ipc-util/renderer";
import currentPlayerStore from "../store/current-player-store";
import {setupRendererAppConfig} from "@/common/app-config/renderer";
import currentProgressStore from "../store/current-progress-store";
import currentLyricStore from "../store/current-lyric-store";

export default async function () {
  // let prevTimestamp = 0;
  // TODO: broadcast
  await setupRendererAppConfig();

  window.extPort.sendToMain({
    type: "sync-all-data",
  });

  window.extPort.on((message) => {
    const { type, data } = message ?? {};
    console.log("[Message from mainWindow] ", message);
    if (type === "sync-all-data") {
      currentPlayerStore.setValue(data);
      currentProgressStore.setValue(data.progress);
      currentLyricStore.setValue(data.currentLyric);
    } else if (type === "sync-current-music") {
      currentPlayerStore.setValue((prev) => ({
        ...prev,
        music: data,
      }));
    } else if (type === "sync-current-playing-state") {
      currentPlayerStore.setValue((prev) => ({
        ...prev,
        playerState: data,
      }));
    } else if (type === "sync-current-repeat-mode") {
      currentPlayerStore.setValue((prev) => ({
        ...prev,
        repeatMode: data,
      }));
    } else if (type === "sync-lyric") {
      currentPlayerStore.setValue((prev) => ({
        ...prev,
        lyric: data,
      }));
    } else if (type === "sync-progress") {
      currentProgressStore.setValue(data);
    } else if (type === "sync-current-lyric") {
      currentLyricStore.setValue(data);
    }
  });
}
