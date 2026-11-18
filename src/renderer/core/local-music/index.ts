import localMusicListStore from "./store";
import { getUserPreferenceIDB } from "@/renderer/utils/user-perference";
import * as Comlink from "comlink";
import musicSheetDB from "../db/music-sheet-db";
import { getGlobalContext } from "@/shared/global-context/renderer";
import { fsUtil } from "@shared/utils/renderer";

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

/**
 * 扫描后对账：把本地音乐库里「文件已经不存在」的条目清掉。
 *
 * chokidar 只在应用运行期间推送 add/unlink 事件，应用没运行时被删掉的文件
 * 永远不会触发 unlink，这些条目就会一直留在本地音乐列表里（点开是播不了的空壳）。
 * 所以每次扫描之后都按文件系统的真实状态对一次账。
 */
async function reconcileLocalMusic() {
    try {
        const watchDirs =
            (await getUserPreferenceIDB("localWatchDirChecked")) ?? [];
        if (!watchDirs.length) {
            return;
        }
        // 只对确实能访问到的目录做对账：目录读不到（比如移动硬盘没插）时宁可不删
        const reachableDirs: string[] = [];
        for (const dir of watchDirs) {
            if (await fsUtil.isFolder(dir)) {
                reachableDirs.push(dir);
            }
        }
        if (!reachableDirs.length) {
            return;
        }

        const allMusic = await musicSheetDB.localMusicStore.toArray();
        const staleItems: IMusicItemWithLocalPath[] = [];
        for (const item of allMusic) {
            // 只处理扫描范围内的目录，别动其它地方来的条目
            if (
                !reachableDirs.some((dir) => isSubDir(dir, item.$$localPath))
            ) {
                continue;
            }
            if (!(await fsUtil.isFile(item.$$localPath))) {
                staleItems.push(item);
            }
        }
        if (!staleItems.length) {
            return;
        }

        await musicSheetDB.transaction(
            "rw",
            musicSheetDB.localMusicStore,
            async () => {
                await musicSheetDB.localMusicStore.bulkDelete(
                    staleItems.map((it) => [it.platform, it.id]),
                );
            },
        );
        localMusicListStore.setValue(
            await musicSheetDB.localMusicStore.toArray(),
        );
    } catch (e) {
        console.log("对账本地音乐失败", e);
    }
}

async function setupLocalMusic() {
    try {
        const localWatchDir =
            (await getUserPreferenceIDB("localWatchDirChecked")) ?? [];


        const localFileWatcherWorkerPath =
            getGlobalContext().workersPath.localFileWatcher;
        if (localFileWatcherWorkerPath) {
            const worker = new Worker(localFileWatcherWorkerPath);
            localFileWatcherWorker = Comlink.wrap(worker);
            await localFileWatcherWorker.setupWatcher(localWatchDir);
        }

        const allMusic = await musicSheetDB.localMusicStore.toArray();

        localMusicListStore.setValue(allMusic);

        // 启动即扫描，对账一次：清掉应用未运行时被删掉的文件留下的空壳条目
        await reconcileLocalMusic();
        localFileWatcherWorker.onAdd(
            Comlink.proxy(async (musicItems: IMusicItemWithLocalPath[]) => {
                await musicSheetDB.transaction(
                    "rw",
                    musicSheetDB.localMusicStore,
                    async () => {
                        await musicSheetDB.localMusicStore.bulkPut(musicItems);
                        const allMusic = await musicSheetDB.localMusicStore.toArray();
                        localMusicListStore.setValue(allMusic);
                    },
                );
            }),
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
                            tobeDeletedPrimaryKeys,
                        );
                        localMusicListStore.setValue(newCachedLocalMusic);
                    },
                );
            }),
        );
    } catch {
    }
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
                            isSubDir(deletePath, it.$$localPath),
                        ),
                    )
                    .map((it) => [it.platform, it.id]);
                await musicSheetDB.localMusicStore.bulkDelete(tobeDeletedItems);
            },
        );

        localMusicListStore.setValue(await musicSheetDB.localMusicStore.toArray());
    }
    // 通知
    localFileWatcherWorker.changeWatchPath(tobeAddedPaths, tobeDeletedPaths);

    // 扫描完对账，把文件已经不存在的条目清掉
    await reconcileLocalMusic();
}

// async function syncLocalMusic() {
//   ipcRendererSend("sync-local-music");
// }

export default {
    setupLocalMusic,
    // syncLocalMusic,
    changeWatchPath,
};
