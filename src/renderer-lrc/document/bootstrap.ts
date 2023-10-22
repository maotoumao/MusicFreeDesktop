import { ipcRendererOn, ipcRendererSend } from "@/common/ipc-util/renderer";
import currentLyricStore from "../store/current-lyric-store";
import rendererAppConfig from "@/common/app-config/renderer";
import currentProgressStore from "../store/current-progress-store";

export default async function () {
  // let prevTimestamp = 0;
  // TODO: broadcast
  await rendererAppConfig.setupRendererAppConfig();

  window.extPort.sendToMain({
    type: "sync-all-data",
  });

  window.extPort.on((message) => {
    const { type, data } = message ?? {};
    console.log(`[Message from mainWindow] `, message);
    if (type === "sync-all-data") {
      currentLyricStore.setValue(data);
      currentProgressStore.setValue(data.progress);
    } else if (type === "sync-current-music") {
      currentLyricStore.setValue((prev) => ({
        ...prev,
        music: data,
      }));
    } else if (type === "sync-current-playing-state") {
      currentLyricStore.setValue((prev) => ({
        ...prev,
        playerState: data,
      }));
    } else if (type === "sync-current-repeat-mode") {
      currentLyricStore.setValue((prev) => ({
        ...prev,
        repeatMode: data,
      }));
    } else if (type === "sync-lyric") {
      currentLyricStore.setValue((prev) => ({
        ...prev,
        lyric: data,
      }));
    } else if (type === "sync-progress") {
      currentProgressStore.setValue(data);
    }
  });
}
