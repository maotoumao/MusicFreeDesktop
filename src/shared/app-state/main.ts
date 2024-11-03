import {PlayerState, RepeatMode} from "@/common/constant";
import {IWindowManager} from "@/types/main/window-manager";
import {ipcMain} from "electron";
import EventEmitter from "eventemitter3";


interface IEvts {
    "MusicChanged": IMusic.IMusicItem | null;
    "PlayerStateChanged": PlayerState;
    "RepeatModeChanged": RepeatMode;
    LyricChanged: string | null;
}

class AppState {
    music: IMusic.IMusicItem | null;
    playerState: PlayerState = PlayerState.None;
    repeatMode: RepeatMode = RepeatMode.Queue;
    lyric: string | null = null;

    private ee = new EventEmitter();


    setup(windowManager: IWindowManager) {
        windowManager.on("WindowCreated", ({windowName}) => {
            if (windowName !== "main") {
                return;
            }

            ipcMain.on("sync-current-music", (_evt, musicItem) => {
                this.music = musicItem;
                this.ee.emit("MusicChanged", musicItem);
            });

            ipcMain.on("sync-current-player-state", (_evt, playerState) => {
                this.playerState = playerState;
                this.ee.emit("PlayerStateChanged", playerState)
            });

            ipcMain.on("sync-current-repeat-mode", (_evt, repeatMode) => {
                this.repeatMode = repeatMode;
                this.ee.emit("RepeatModeChanged", repeatMode);
            });

            ipcMain.on("sync-current-lyric", (_evt, lyric) => {
                this.lyric = lyric;
                this.ee.emit("LyricChanged", lyric);
            });
        })
    }

    on<T extends keyof IEvts>(event: T, listener: (value: IEvts[T]) => void) {
        this.ee.on(event, listener);
    }

    isPlaying() {
        return this.playerState === PlayerState.Playing;
    }

    isPaused() {
        return this.playerState !== PlayerState.Playing
    }


}


export default new AppState();
