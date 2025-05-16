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
    getDuration: () => ipcRenderer.invoke("mpv-get-duration"),
    getCurrentTime: () => ipcRenderer.invoke("mpv-get-current-time"),
    quit: () => ipcRenderer.invoke("mpv-quit"),
    setProperty: (property: string, value: any) => ipcRenderer.invoke("mpv-set-property", property, value), // +++ 新增这一行 +++
};

const mpvPlayerListener = {
    onStatusChange: (callback: (status: any) => void) =>
        ipcRenderer.on("mpv-statuschange", (_event, status) => callback(status)),
    onPaused: (callback: (data: { state: PlayerState }) => void) => // 明确 PlayerState 类型
        ipcRenderer.on("mpv-paused", (_event, data) => callback(data)),
    onResumed: (callback: (data: { state: PlayerState }) => void) => // 明确 PlayerState 类型
        ipcRenderer.on("mpv-resumed", (_event, data) => callback(data)),
    onTimePosition: (callback: (data: { time: number, duration: number }) => void) =>
        ipcRenderer.on("mpv-timeposition", (_event, data) => callback(data)),
    onStopped: (callback: (data: { state: PlayerState }) => void) => // 明确 PlayerState 类型
        ipcRenderer.on("mpv-stopped", (_event, data) => callback(data)),
    onStarted: (callback: (data: { state: PlayerState }) => void) => // 明确 PlayerState 类型
        ipcRenderer.on("mpv-started", (_event, data) => callback(data)),
    onPlaybackEnded: (callback: (data: { reason: string }) => void) =>
        ipcRenderer.on("mpv-playback-ended", (_event, data) => callback(data)),
    onError: (callback: (error: string) => void) =>
        ipcRenderer.on("mpv-error", (_event, error) => callback(error)),
    onInitFailed: (callback: (errorMsg?: string) => void) => // 修改点：接收可选的错误消息
        ipcRenderer.on("mpv-init-failed", (_event, errorMsg) => callback(errorMsg)),
    onInitSuccess: (callback: () => void) =>
        ipcRenderer.on("mpv-init-success", () => callback()),
    removeAllMpvListeners: (channel?: string) => {
        const channels = channel ? [channel] : [
            "mpv-statuschange", "mpv-paused", "mpv-resumed",
            "mpv-timeposition", "mpv-stopped", "mpv-started",
            "mpv-playback-ended", "mpv-error", "mpv-init-failed", "mpv-init-success"
            // 添加其他你可能定义的 mpv 事件
        ];
        channels.forEach(ch => ipcRenderer.removeAllListeners(ch));
    }
};


contextBridge.exposeInMainWorld("electron", {
    ...(window.electron || {}), // 保留其他可能已暴露的API
    mpvPlayer,
    mpvPlayerListener,
});