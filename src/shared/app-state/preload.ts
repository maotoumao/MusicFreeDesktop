import {contextBridge, ipcRenderer} from "electron";
import {PlayerState, RepeatMode} from "@/common/constant";


function syncCurrentMusic(musicItem: IMusic.IMusicItem | null) {
    ipcRenderer.send("sync-current-music", musicItem);
}

function syncCurrentPlayerState(playerState: PlayerState) {
    ipcRenderer.send("sync-current-player-state", playerState);
}

function syncCurrentRepeatMode(state: RepeatMode) {
    ipcRenderer.send("sync-current-repeat-mode", state);
}

function syncCurrentLyric(lyric: string) {
    ipcRenderer.send("sync-current-lyric", lyric);
}


const mod = {
    syncCurrentMusic,
    syncCurrentPlayerState,
    syncCurrentRepeatMode,
    syncCurrentLyric
}

contextBridge.exposeInMainWorld("@shared/app-state", mod);
