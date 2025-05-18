// src/preload/index.ts
import "./common-preload";
import "@shared/service-manager/preload";
import "@shared/plugin-manager/preload";
import "@shared/message-bus/preload/main";
import "@shared/short-cut/preload";
import {contextBridge, ipcRenderer} from "electron";
import { PlayerState } from "@/common/constant";

const mpvPlayer = {
    initialize: () => ipcRenderer.invoke("mpv-initialize"),
    load: (filePath: string, track: IMusic.IMusicItem) => ipcRenderer.invoke("mpv-load", filePath, track),
    play: () => ipcRenderer.invoke("mpv-play"),
    pause: () => ipcRenderer.invoke("mpv-pause"),
    resume: () => ipcRenderer.invoke("mpv-resume"),
    stop: () => ipcRenderer.invoke("mpv-stop"),
    seek: (timeSeconds: number) => ipcRenderer.invoke("mpv-seek", timeSeconds),
    setVolume: (volume: number) => ipcRenderer.invoke("mpv-set-volume", volume),
    setSpeed: (speed: number) => ipcRenderer.invoke("mpv-set-speed", speed),
    getDuration: (): Promise<number | null> => ipcRenderer.invoke("mpv-get-duration"),
    getCurrentTime: (): Promise<number> => ipcRenderer.invoke("mpv-get-current-time"),
    quit: () => ipcRenderer.invoke("mpv-quit"),
    setProperty: (property: string, value: any) => ipcRenderer.invoke("mpv-set-property", property, value),
    // +++ 新增：允许渲染进程通知主进程轨道已加载 +++
    signalTrackLoaded: () => ipcRenderer.send("mpv-signal-track-loaded"),
};

const mpvPlayerListener = {
    onPaused: (callback: (data: { state: PlayerState }) => void) =>
        ipcRenderer.on("mpv-paused", (_event, data) => callback(data)),
    onResumed: (callback: (data: { state: PlayerState }) => void) =>
        ipcRenderer.on("mpv-resumed", (_event, data) => callback(data)),
    onTimePosition: (callback: (data: { time: number, duration: number | null }) => void) =>
        ipcRenderer.on("mpv-timeposition", (_event, data) => callback(data)),
    onStopped: (callback: (data: { state: PlayerState, reason?: string }) => void) =>
        ipcRenderer.on("mpv-stopped", (_event, data) => callback(data)),
    onStarted: (callback: (data: { state: PlayerState }) => void) => // state is less important here, event itself matters
        ipcRenderer.on("mpv-started", (_event, data) => callback(data)),
    onPlaybackEnded: (callback: (data: { reason: string }) => void) =>
        ipcRenderer.on("mpv-playback-ended", (_event, data) => callback(data)),
    onError: (callback: (error: string) => void) =>
        ipcRenderer.on("mpv-error", (_event, error) => callback(error)),
    onInitFailed: (callback: (errorMsg?: string) => void) =>
        ipcRenderer.on("mpv-init-failed", (_event, errorMsg) => callback(errorMsg)),
    onInitSuccess: (callback: () => void) =>
        ipcRenderer.on("mpv-init-success", () => callback()),
    onVolumeChange: (callback: (data: { volume: number }) => void) =>
        ipcRenderer.on("mpv-volumechange", (_event, data) => callback(data)),
    onSpeedChange: (callback: (data: { speed: number }) => void) =>
        ipcRenderer.on("mpv-speedchange", (_event, data) => callback(data)),
    onReinitializedAfterCrash: (callback: (data: { track: IMusic.IMusicItem, time: number, wasPlaying: boolean }) => void) =>
        ipcRenderer.on("mpv-reinitialized-after-crash", (_event, data) => callback(data)),
    removeAllMpvListeners: (channel?: string) => {
        const channels = channel ? [channel] : [
            "mpv-paused", "mpv-resumed", "mpv-timeposition",
            "mpv-stopped", "mpv-started", "mpv-playback-ended",
            "mpv-error", "mpv-init-failed", "mpv-init-success",
            "mpv-volumechange", "mpv-speedchange", "mpv-reinitialized-after-crash"
        ];
        channels.forEach(ch => ipcRenderer.removeAllListeners(ch));
    }
};


contextBridge.exposeInMainWorld("electron", {
    ...(window.electron || {}),
    mpvPlayer,
    mpvPlayerListener,
});