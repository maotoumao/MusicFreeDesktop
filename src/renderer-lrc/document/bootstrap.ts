import { ipcRendererOn } from "@/common/ipc-util/renderer";
import currentLyricStore from "../store/current-lyric-store";


export default async function () {
  let prevTimestamp = 0;
  ipcRendererOn('send-to-lyric-window', (data) => {
    if(data.timeStamp > prevTimestamp) {
      prevTimestamp = data.timeStamp;
      currentLyricStore.setValue(data.lrc);
    }
  })
}

