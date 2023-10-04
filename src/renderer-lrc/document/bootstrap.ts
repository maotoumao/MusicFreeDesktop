import { ipcRendererOn, ipcRendererSend } from "@/common/ipc-util/renderer";
import currentLyricStore from "../store/current-lyric-store";
import rendererAppConfig from "@/common/app-config/renderer";


export default async function () {
  // let prevTimestamp = 0;
  // TODO: broadcast
  ipcRendererOn('sync-extension-data', (data) => {
    currentLyricStore.setValue(prev => ({
      ...prev,
      ...(data.data)
    }))
  })
  await rendererAppConfig.setupRendererAppConfig();

  ipcRendererSend('extension-inited');
}

