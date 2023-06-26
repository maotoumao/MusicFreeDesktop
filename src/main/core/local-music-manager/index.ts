import { Worker } from "worker_threads";
import path from "path";

export async function setupLocalMusicManager() {
  const worker: Worker = new Worker(path.resolve(__dirname, "scanner.worker"), {
    workerData: {
      aaa: "sddasd",
    },
  });
  worker.on("message", (data) => {
    console.log(data, "收到啦！！");
  });
}
