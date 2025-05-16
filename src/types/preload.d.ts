// src/types/preload.d.ts
import { PlayerState } from "@/common/constant"; // 确保 PlayerState 被正确导入

interface Window {
  path: typeof import("node:path");
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
      setVolume: (volume: number) => Promise<void>; // MPV 音量是 0-100
      setSpeed: (speed: number) => Promise<void>;
      getDuration: () => Promise<number | null>;
      getCurrentTime: () => Promise<number>;
      quit: () => Promise<void>;
    };
    mpvPlayerListener: {
      onStatusChange: (callback: (status: any) => void) => Electron.IpcRenderer; // 返回 IpcRenderer 方便移除
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
  };
}