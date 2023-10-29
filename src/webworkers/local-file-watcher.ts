import * as Comlink from "comlink";
import * as chokidar from "chokidar";
import path from "path";
import { supportLocalMediaType } from "@/common/constant";
import debounce from "lodash.debounce";
import { parseLocalMusicItem } from "@/common/file-util";

let watcher: chokidar.FSWatcher;

const addedMusicItems: IMusic.IMusicItem[] = [];
const removedFilePaths: string[] = [];

let _onAdd: (musicItems: IMusic.IMusicItem[]) => void;
let _onRemove: (filePaths: string[]) => void;

async function setupWatcher(initPaths?: string[]) {
  watcher = chokidar.watch(initPaths ?? [], {
    depth: 10,
    persistent: true,
    ignorePermissionErrors: true,
  });

  watcher.on("add", async (fp, stats) => {
    if (
      stats.isFile() &&
      supportLocalMediaType.some((postfix) => fp.endsWith(postfix))
    ) {
      const musicItem = await parseLocalMusicItem(fp);
      musicItem.$$localPath = fp;
      addedMusicItems.push(musicItem);
      syncAddedMusic();
    }
  });

  watcher.on("unlink", (fp) => {
    if (supportLocalMediaType.some((postfix) => fp.endsWith(postfix))) {
      removedFilePaths.push(fp);
      syncRemovedFilePaths();
    }
  });
}

const syncAddedMusic = debounce(
  () => {
    const copyOfAddedMusicItems = [...addedMusicItems];
    addedMusicItems.length = 0;
    _onAdd?.(copyOfAddedMusicItems);
  },
  500,
  {
    leading: false,
    trailing: true,
  }
);

const syncRemovedFilePaths = debounce(
  () => {
    const copyOfRemovedFilePaths = [...removedFilePaths];
    removedFilePaths.length = 0;
    _onRemove?.(copyOfRemovedFilePaths);
  },
  500,
  {
    leading: false,
    trailing: true,
  }
);

async function changeWatchPath(addPaths?: string[], rmPaths?: string[]) {
  console.log(addPaths, rmPaths);
  try {
    if (addPaths?.length) {
      watcher.add(addPaths);
    }
    if (rmPaths?.length) {
      watcher.unwatch(rmPaths);
      /**
       * chokidar的bug: https://github.com/paulmillr/chokidar/issues/1027
       * unwatch之后重新watch不会触发文件更新
       */
      rmPaths.forEach((it) => {
        // @ts-ignore
        const watchedDirEntry = watcher._watched.get(it);
        if (watchedDirEntry) {
          // 移除所有子节点的监听
          watchedDirEntry._removeWatcher(
            path.dirname(it),
            path.basename(it),
            true
          );
        }
        // watcher._watched.delete(it);
      });
    }
    console.log("WATCH PATH CHANGED", addPaths, rmPaths, watcher);
  } catch (e) {
    console.log(e);
  }
}

async function onAdd(fn: (musicItems: IMusic.IMusicItem[]) => void) {
  _onAdd = fn;
}

async function onRemove(fn: (filePaths: string[]) => void) {
  _onRemove = fn;
}

Comlink.expose({
  setupWatcher,
  changeWatchPath,
  onAdd,
  onRemove,
});
