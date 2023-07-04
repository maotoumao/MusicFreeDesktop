import { Worker } from "worker_threads";
import path from "path";
import { ipcMainOn, ipcMainSendMainWindow } from "@/common/ipc-util/main";

let scannerWorker: Worker;

export async function setupLocalMusicManager() {
  scannerWorker = new Worker(path.resolve(__dirname, "scanner.worker"));

  ipcMainOn("add-watch-dir", (dirs) => {
    scannerWorker.postMessage({
      type: "addWatchDir",
      data: dirs,
    });
  });

  ipcMainOn("remove-watch-dir", (dirs) => {
    scannerWorker.postMessage({
      type: "rmWatchDir",
      data: dirs,
    });
  });

  ipcMainOn("set-watch-dir", (actions) => {
    scannerWorker.postMessage({
      type: "setWatchDir",
      data: actions,
    });
  });

  ipcMainOn("sync-local-music", () => {
    scannerWorker.postMessage({
      type: "sync",
    });
  });

  scannerWorker.on("message", (data) => {
    if (data.type === "sync-music") {
      ipcMainSendMainWindow("sync-local-music", data.data);
    }
  });

}
