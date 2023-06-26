// /***** thread ******/
import { parentPort } from "worker_threads";
import * as chokidar from "chokidar";
import path from "path";
import { supportLocalMediaType } from "@/common/constant";
import { parseLocalMusicItem } from "@/common/file-util";
import debounce from "lodash.debounce";

const watcher = chokidar.watch([], {
  usePolling: true,
});

let localMusicList: IMusic.IMusicItem[] = [];

watcher.on("add", async (fp) => {
  if (supportLocalMediaType.some((postfix) => fp.endsWith(postfix))) {
    localMusicList.push(await parseLocalMusicItem(fp));
    syncMusic();
  }
});

watcher.on("unlink", (fp) => {
  const target = localMusicList.findIndex((item) => item.rawPath === fp);
  if (target !== -1) {
    localMusicList.splice(target, 1);
    syncMusic();
  }
});

parentPort.on("message", (data = {}) => {
  if (data.type === "addWatchDir") {
    watcher.add(data.data ?? []);
  } else if (data.type === "rmWatchDir") {
    watcher.unwatch(data.data);
  } else if (data.type === "sync") {
    refreshMusicItems();
  }
});

async function refreshMusicItems() {
  const paths = watcher.getWatched();
  const result: IMusic.IMusicItem[] = [];
  for (const dir in paths) {
    for (const fp in paths[dir]) {
      if (supportLocalMediaType.some((postfix) => fp.endsWith(postfix))) {
        const fullPath = path.resolve(dir, fp);
        result.push(await parseLocalMusicItem(fullPath));
      }
    }
  }
  localMusicList = result;
  syncMusic();
}

// 防止高频同步
const syncMusic = debounce(
  () => {
    parentPort.postMessage({
      type: "sync-music",
      data: localMusicList,
    });
  },
  500,
  {
    leading: false,
    trailing: true,
  }
);
