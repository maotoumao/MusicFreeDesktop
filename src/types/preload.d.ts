// src/types/preload.d.ts
// import type NodePath from "node:path"; // 不再需要

interface Window {
  // path: typeof NodePath; // <--- 移除这一行
  electron: {
    // ... (保留其他 electron API 声明)
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
      setProperty: (property: string, value: any) => Promise<void>; // +++ 新增这一行 +++
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
  };
  // 如果 @shared/utils 模块仍然通过 contextBridge 暴露，保留其类型声明
  // 例如: ['@shared/utils']: typeof import('../shared/utils/preload').mod;
}