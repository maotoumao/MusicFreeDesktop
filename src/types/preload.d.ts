// src/types/preload.d.ts

// 确保 PlayerState 被正确导入，如果它在 window.electron 的类型中被引用
import { PlayerState } from "@/common/constant"; // 假设 PlayerState 在这里定义

// 扩展全局 Window 接口
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
        setVolume: (volume: number) => Promise<void>; // volume is 0-1 for this call to main
        setSpeed: (speed: number) => Promise<void>;
        getDuration: () => Promise<number | null>;
        getCurrentTime: () => Promise<number>;
        quit: () => Promise<void>;
        setProperty: (property: string, value: any) => Promise<void>;
      };
      mpvPlayerListener: {
        onStatusChange: (callback: (status: any) => void) => Electron.IpcRenderer; // Consider defining a more specific 'status' type if possible
        onPaused: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onResumed: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onTimePosition: (callback: (data: { time: number, duration: number | null }) => void) => Electron.IpcRenderer;
        onStopped: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onStarted: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer; // data might be optional or just { state: PlayerState }
        onPlaybackEnded: (callback: (data: { reason: string }) => void) => Electron.IpcRenderer;
        onError: (callback: (error: string) => void) => Electron.IpcRenderer;
        onInitFailed: (callback: (errorMsg?: string) => void) => Electron.IpcRenderer;
        onInitSuccess: (callback: () => void) => Electron.IpcRenderer;
        // +++ 新增的类型定义 +++
        onVolumeChange: (callback: (data: { volume: number }) => void) => Electron.IpcRenderer;
        onSpeedChange: (callback: (data: { speed: number }) => void) => Electron.IpcRenderer;
        // +++ 结束新增 +++
        removeAllMpvListeners: (channel?: string) => void;
      };
      // 这里可以继续声明其他通过 contextBridge 暴露的 API
      // 例如：
      // "@shared/utils": typeof import("../../shared/utils/preload").mod; // 示例，具体路径和模块名需匹配你的项目
      // ... 其他模块 ...
    };
  }
}

// 为了确保这个文件被视为模块（如果它包含顶级 import/export），
// 或者确保它被视为全局脚本（如果没有顶级 import/export）。
// 如果出现 "Augmentations for the global scope can only be directly nested in external modules or ambient module declarations."
// 错误，可以添加一个空的 export {} 来将其标记为模块。
export {};