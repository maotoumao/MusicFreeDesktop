import { ipcRendererSend, ipcRendererOn } from "@/common/ipc-util/renderer";
import localMusicListStore from "./store";
import { getUserPerferenceIDB, setUserPerferenceIDB } from "@/renderer/utils/user-perference";

let localWatchDir: string[] = [];
async function setupLocalMusic(){
    localWatchDir = await getUserPerferenceIDB('localWatchDir');
    ipcRendererSend("add-watch-dir", localWatchDir);
    ipcRendererOn("sync-local-music", (items) => {
        console.log("set!!", items);
      localMusicListStore.setValue(items);
    });
}

async function addWatchDir(dirs: string | string[]){
    dirs = Array.isArray(dirs) ? dirs : [dirs];
    ipcRendererSend('add-watch-dir', dirs);
    const newDir = [...localWatchDir, ...dirs];
    const isSuccess = await setUserPerferenceIDB('localWatchDir', newDir);
    if(isSuccess) {
        localWatchDir = newDir;
    }
}

async function rmWatchDir(dirs: string | string[]){
    dirs = Array.isArray(dirs) ? dirs : [dirs];
    ipcRendererSend('remove-watch-dir', dirs);
    const newDir = localWatchDir.filter(dir => !dirs.includes(dir));
    const isSuccess = await setUserPerferenceIDB('localWatchDir', newDir);
    if(isSuccess) {
        localWatchDir = newDir;
    }
}

async function syncLocalMusic(){
    ipcRendererSend('sync-local-music');
}


export default {
    setupLocalMusic,
    addWatchDir,
    rmWatchDir,
    syncLocalMusic
}