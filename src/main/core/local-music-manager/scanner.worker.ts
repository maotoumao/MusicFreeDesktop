// /***** thread ******/
import { parentPort } from "worker_threads";
import * as chokidar from "chokidar";
import path from "path";
import { supportLocalMediaType } from "@/common/constant";
import { parseLocalMusicItem } from "@/common/file-util";
import debounce from "lodash.debounce";

// 所属文件夹
const folderSymbol = Symbol.for("folder");

const watcher = chokidar.watch([], {
  usePolling: true,
});

let localMusicList: IMusic.IMusicItem[] = [];

watcher.on("add", async (fp, stats) => {
  if (
    stats.isFile() &&
    supportLocalMediaType.some((postfix) => fp.endsWith(postfix))
  ) {
    const musicItem = await parseLocalMusicItem(fp);
    musicItem[folderSymbol] = path.dirname(fp);
    localMusicList.push(musicItem);
    syncMusic();
  }
});

watcher.on("unlink", (fp) => {
  const target = localMusicList.findIndex((item) => item.localPath === fp);
  if (target !== -1) {
    localMusicList.splice(target, 1);
    syncMusic();
  }
});

parentPort.on("message", (data = {}) => {
  if (data.type === "addWatchDir") {
    watcher.add(data.data ?? []);
  } else if (data.type === "rmWatchDir") {
    rmWatchDir(data.data ?? []);
  } else if (data.type === "sync") {
    refreshMusicItems();
  } else if (data.type === "setWatchDir") {
    setWatchDir(data.data);
  }
});

function rmWatchDir(dirs: string[]) {
  localMusicList = localMusicList.filter(
    (item) => !dirs.includes(item[folderSymbol])
  );
  watcher.unwatch(dirs);
  console.log(watcher)
  syncMusic();
}

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

function setWatchDir(actions: { add: string[]; rm: string[] }) {
  if (actions.rm.length) {
    rmWatchDir(actions.rm);
  }
  if (actions.add.length) {
    watcher.add(actions.add);
  }
  // console.log(actions, 'SET WATCH', watcher.getWatched());
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
