// src/types/preload.d.ts 或 global.d.ts

// 确保 PlayerState 被正确导入，如果它在 window.electron 的类型中被引用
import { PlayerState } from "@/common/constant";

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
        setVolume: (volume: number) => Promise<void>;
        setSpeed: (speed: number) => Promise<void>;
        getDuration: () => Promise<number | null>;
        getCurrentTime: () => Promise<number>;
        quit: () => Promise<void>;
        setProperty: (property: string, value: any) => Promise<void>;
      };
      mpvPlayerListener: {
        onStatusChange: (callback: (status: any) => void) => Electron.IpcRenderer;
        onPaused: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onResumed: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onTimePosition: (callback: (data: { time: number, duration: number }) => void) => Electron.IpcRenderer;
        onStopped: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer;
        onStarted: (callback: (data: { state: PlayerState }) => void) => Electron.IpcRenderer; // PlayerState 类型
        onPlaybackEnded: (callback: (data: { reason: string }) => void) => Electron.IpcRenderer;
        onError: (callback: (error: string) => void) => Electron.IpcRenderer;
        onInitFailed: (callback: (errorMsg?: string) => void) => Electron.IpcRenderer;
        onInitSuccess: (callback: () => void) => Electron.IpcRenderer;
        removeAllMpvListeners: (channel?: string) => void;
      };
      // 如果还有其他通过 contextBridge 暴露的 API，也在这里声明
      // 例如：
      // ['@shared/utils']: typeof import('../shared/utils/preload').mod;
      // 等等
    };
  }
}

// 为了确保这个文件被视为模块（如果它包含顶级 import/export），
// 或者确保它被视为全局脚本（如果没有顶级 import/export），
// 如果出现 "Augmentations for the global scope can only be directly nested in external modules or ambient module declarations."
// 错误，可以添加一个空的 export {} 来将其标记为模块。
// 但通常对于 .d.ts 文件，declare global 应该是有效的。
// 如果还是不行，尝试将 PlayerState 的导入移到 declare global 内部（如果允许）。

export {}; // 这会将文件视为一个模块，允许 declare global