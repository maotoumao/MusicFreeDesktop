// src/preload/index.ts
import "./common-preload";
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import "@shared/service-manager/preload";
import "@shared/plugin-manager/preload";
import "@shared/message-bus/preload/main";
import "@shared/short-cut/preload";
import {contextBridge, ipcRenderer} from "electron";
import { PlayerState } from "@/common/constant"; // 确保 PlayerState 被正确导入

// 新增 MPV 相关 preload
const mpvPlayer = {
    initialize: () => ipcRenderer.invoke("mpv-initialize"),
    load: (filePath: string, track: IMusic.IMusicItem) => ipcRenderer.invoke("mpv-load", filePath, track),
    play: () => ipcRenderer.invoke("mpv-play"),
    pause: () => ipcRenderer.invoke("mpv-pause"),
    resume: () => ipcRenderer.invoke("mpv-resume"), // 在 MPV 中，resume 通常等同于 play
    stop: () => ipcRenderer.invoke("mpv-stop"),
    seek: (timeSeconds: number) => ipcRenderer.invoke("mpv-seek", timeSeconds),
    setVolume: (volume: number) => ipcRenderer.invoke("mpv-set-volume", volume), // MPV 音量是 0-100
    setSpeed: (speed: number) => ipcRenderer.invoke("mpv-set-speed", speed),
    getDuration: () => ipcRenderer.invoke("mpv-get-duration"),
    getCurrentTime: () => ipcRenderer.invoke("mpv-get-current-time"),
    quit: () => ipcRenderer.invoke("mpv-quit"),
};

const mpvPlayerListener = {
    onStatusChange: (callback: (status: any) => void) =>
        ipcRenderer.on("mpv-statuschange", (_event, status) => callback(status)),
    onPaused: (callback: (data: { state: PlayerState }) => void) =>
        ipcRenderer.on("mpv-paused", (_event, data) => callback(data)),
    onResumed: (callback: (data: { state: PlayerState }) => void) =>
        ipcRenderer.on("mpv-resumed", (_event, data) => callback(data)),
    onTimePosition: (callback: (data: { time: number, duration: number }) => void) => // duration 可能为 null 或 Infinity
        ipcRenderer.on("mpv-timeposition", (_event, data) => callback(data)),
    onStopped: (callback: (data: { state: PlayerState }) => void) => // MPV 停止播放（自然结束或手动停止）
        ipcRenderer.on("mpv-stopped", (_event, data) => callback(data)),
    onStarted: (callback: (data: { state: PlayerState }) => void) => // MPV 开始播放一个文件
        ipcRenderer.on("mpv-started", (_event, data) => callback(data)),
    onPlaybackEnded: (callback: (data: { reason: string }) => void) => // MPV 播放结束事件
        ipcRenderer.on("mpv-playback-ended", (_event, data) => callback(data)),
    onError: (callback: (error: string) => void) =>
        ipcRenderer.on("mpv-error", (_event, error) => callback(error)),
    onInitFailed: (callback: () => void) => // 新增：MPV 初始化失败事件
        ipcRenderer.on("mpv-init-failed", () => callback()),
    onInitSuccess: (callback: () => void) => // 新增：MPV 初始化成功事件
        ipcRenderer.on("mpv-init-success", () => callback()),
    removeAllMpvListeners: (channel?: string) => {
        const channels = channel ? [channel] : [
            "mpv-statuschange", "mpv-paused", "mpv-resumed",
            "mpv-timeposition", "mpv-stopped", "mpv-started",
            "mpv-playback-ended", "mpv-error", "mpv-init-failed", "mpv-init-success"
        ];
        channels.forEach(ch => ipcRenderer.removeAllListeners(ch));
    }
};

declare global {
    interface Window {
        electron?: any;
    }
}

contextBridge.exposeInMainWorld("electron", {
    ...(window.electron || {}),
    mpvPlayer,
    mpvPlayerListener,
});