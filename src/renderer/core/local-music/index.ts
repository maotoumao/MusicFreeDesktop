import { ipcRendererSend, ipcRendererOn } from "@/shared/ipc/renderer";
import localMusicListStore from "./store";
import {
  getUserPreferenceIDB,
  setUserPreferenceIDB,
} from "@/renderer/utils/user-perference";
import * as Comlink from "comlink";
import musicSheetDB from "../db/music-sheet-db";
import { getGlobalContext } from "@/shared/global-context/renderer";

type ProxyMarkedFunction<T extends (...args: any) => void> = T &
  Comlink.ProxyMarked;

type IMusicItemWithLocalPath = IMusic.IMusicItem & { $$localPath: string };

interface ILocalFileWatcherWorker {
  setupWatcher: (initPaths?: string[]) => Promise<void>;
  changeWatchPath: (addPaths?: string[], rmPaths?: string[]) => Promise<void>;
  onAdd: (
    cb: ProxyMarkedFunction<
      (musicItems: Array<IMusicItemWithLocalPath>) => Promise<void>
    >
  ) => void;
  onRemove: (
    cb: ProxyMarkedFunction<(filePaths: string[]) => Promise<void>>
  ) => void;
}

let localFileWatcherWorker: ILocalFileWatcherWorker;

function isSubDir(parent: string, target: string) {
  const relative = window.path.relative(parent, target);
  return (
    relative && !relative.startsWith("..") && !window.path.isAbsolute(relative)
  );
}

async function setupLocalMusic() {
  try {
    const localWatchDir =
      (await getUserPreferenceIDB("localWatchDirChecked")) ?? [];

    // ipcRendererSend("add-watch-dir", localWatchDir);
    // ipcRendererOn("sync-local-music", (items) => {
    //   console.log("set!!", items);
    //   localMusicListStore.setValue(items);
    // });

    const localFileWatcherWorkerPath =
      getGlobalContext().workersPath.localFileWatcher;
    if (localFileWatcherWorkerPath) {
      const worker = new Worker(localFileWatcherWorkerPath);
      localFileWatcherWorker = Comlink.wrap(worker);
      await localFileWatcherWorker.setupWatcher(localWatchDir);
    }

    const allMusic = await musicSheetDB.localMusicStore.toArray();

    localMusicListStore.setValue(allMusic);
    localFileWatcherWorker.onAdd(
      Comlink.proxy(async (musicItems: IMusicItemWithLocalPath[]) => {
        await musicSheetDB.transaction(
          "rw",
          musicSheetDB.localMusicStore,
          async () => {
            await musicSheetDB.localMusicStore.bulkPut(musicItems);
            const allMusic = await musicSheetDB.localMusicStore.toArray();
            localMusicListStore.setValue(allMusic);
          }
        );
      })
    );

    localFileWatcherWorker.onRemove(
      Comlink.proxy(async (filePaths: string[]) => {
        await musicSheetDB.transaction(
          "rw",
          musicSheetDB.localMusicStore,
          async () => {
            const tobeDeletedFilePaths = new Set(filePaths);
            const cachedLocalMusic = localMusicListStore.getValue();
            const tobeDeletedPrimaryKeys: any[] = [];
            const newCachedLocalMusic: IMusicItemWithLocalPath[] = [];
            cachedLocalMusic.forEach((it) => {
              if (tobeDeletedFilePaths.has(it.$$localPath)) {
                tobeDeletedPrimaryKeys.push([it.platform, it.id]);
              } else {
                newCachedLocalMusic.push(it);
              }
            });
            await musicSheetDB.localMusicStore.bulkDelete(
              tobeDeletedPrimaryKeys
            );
            localMusicListStore.setValue(newCachedLocalMusic);
          }
        );
      })
    );
  } catch {}
}

async function changeWatchPath(logs: Map<string, "add" | "delete">) {
  // 对所有的要删除的路径
  const tobeDeletedPaths: string[] = [];
  const tobeAddedPaths: string[] = [];
  logs.forEach((action, dirPath) => {
    if (action === "delete") {
      tobeDeletedPaths.push(dirPath);
    } else {
      tobeAddedPaths.push(dirPath);
    }
  });

  // 删除所有子路径的
  if (tobeDeletedPaths.length) {
    await musicSheetDB.transaction(
      "rw",
      musicSheetDB.localMusicStore,
      async () => {
        const localFiles = localMusicListStore.getValue();
        const tobeDeletedItems = localFiles
          .filter((it) =>
            tobeDeletedPaths.some((deletePath) =>
              isSubDir(deletePath, it.$$localPath)
            )
          )
          .map((it) => [it.platform, it.id]);
        await musicSheetDB.localMusicStore.bulkDelete(tobeDeletedItems);
      }
    );

    localMusicListStore.setValue(await musicSheetDB.localMusicStore.toArray());
  }
  // 通知
  localFileWatcherWorker.changeWatchPath(tobeAddedPaths, tobeDeletedPaths);
}

// async function syncLocalMusic() {
//   ipcRendererSend("sync-local-music");
// }

export default {
  setupLocalMusic,
  // syncLocalMusic,
  changeWatchPath,
};
