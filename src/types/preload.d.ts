// src/types/preload.d.ts
import { PlayerState } from "@/common/constant";

declare global {
  interface Window {
    electron: {
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
        setProperty: (property: string, value: any) => Promise<void>;
        signalTrackLoaded: () => void; // +++ 新增类型定义 +++
      };
      mpvPlayerListener: {
        onPaused: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onResumed: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onTimePosition: (callback: (data: { time: number, duration: number | null }) => void) => Electron.IpcRenderer;
        onStopped: (callback: (data: { state: PlayerState, reason?: string }) => void) => Electron.IpcRenderer;
        onStarted: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onPlaybackEnded: (callback: (data: { reason: string }) => void) => Electron.IpcRenderer;
        onError: (callback: (error: string) => void) => Electron.IpcRenderer;
        onInitFailed: (callback: (errorMsg?: string) => void) => Electron.IpcRenderer;
        onInitSuccess: (callback: () => void) => Electron.IpcRenderer;
        onVolumeChange: (callback: (data: { volume: number }) => void) => Electron.IpcRenderer;
        onSpeedChange: (callback: (data: { speed: number }) => void) => Electron.IpcRenderer;
        onReinitializedAfterCrash: (callback: (data: { track: IMusic.IMusicItem, time: number, wasPlaying: boolean }) => void) => Electron.IpcRenderer;
        removeAllMpvListeners: (channel?: string) => void;
      };
    };
  }
}
export {};