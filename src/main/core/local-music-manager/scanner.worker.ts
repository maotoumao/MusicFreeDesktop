// /***** thread ******/
import { parentPort, isMainThread, workerData } from "worker_threads";
import * as chokidar from "chokidar";
import { supportLocalMediaType } from "@/common/constant";

const watchDirs: string[] = [];

console.log(workerData, "什么东西");
parentPort.postMessage("what the fuck!!!!");
