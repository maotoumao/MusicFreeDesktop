import { ipcRendererOn } from "@/common/ipc-util/renderer";
import currentLyricStore from "../store/current-lyric-store";
import rendererAppConfig from "@/common/app-config/renderer";


export default async function () {
  let prevTimestamp = 0;
  ipcRendererOn('send-to-lyric-window', (data) => {
    if(data.timeStamp > prevTimestamp) {
      prevTimestamp = data.timeStamp;
      currentLyricStore.setValue(data.lrc);
    }
  })
  await rendererAppConfig.setupRendererAppConfig();
}

