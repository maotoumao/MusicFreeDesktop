// src/types/preload.d.ts
import { PlayerState } from "@/common/constant";
import type NodePath from "node:path"; // 导入 NodeJS path 模块的类型

interface Window {
  path: typeof NodePath; // 声明 window.path 的类型为 NodeJS path 模块的类型
  electron: {
    // ... 其他已有的 electron API
    mpvPlayer: {
      initialize: () => Promise<boolean>;
      load: (filePath: string, track: IMusic.IMusicItem) => Promise<void>;
      play: () => Promise<void>;
      pause: () => Promise<void>;
      resume: () => Promise<void>;
      stop: () => Promise<void>;
      seek: (timeSeconds: number) => Promise<void>;
      setVolume: (volume: number) => Promise<void>;
      setSpeed: (speed: number) => Promise<void>;
      getDuration: () => Promise<number | null>;
      getCurrentTime: () => Promise<number>;
      quit: () => Promise<void>;
    };
    mpvPlayerListener: {
      onStatusChange: (callback: (status: any) => void) => Electron.IpcRenderer;
      onPaused: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
      onResumed: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
      onTimePosition: (callback: (data: { time: number, duration: number }) => void) => Electron.IpcRenderer;
      onStopped: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
      onStarted: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
      onPlaybackEnded: (callback: (data: { reason: string }) => void) => Electron.IpcRenderer;
      onError: (callback: (error: string) => void) => Electron.IpcRenderer;
      onInitFailed: (callback: () => void) => Electron.IpcRenderer;
      onInitSuccess: (callback: () => void) => Electron.IpcRenderer;
      removeAllMpvListeners: (channel?: string) => void;
    };
    // 如果还有其他通过 contextBridge 暴露的 API，也在这里声明
  };
}