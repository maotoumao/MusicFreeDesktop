import { BrowserWindow } from "electron";

export type IWindowNames = "main" | "lyric" | "minimode";

export interface IWindowEvents {
    "WindowCreated": {
        windowName: IWindowNames;
        browserWindow: BrowserWindow;
    }
}

export interface IWindowManager {

    mainWindow: BrowserWindow | null;
    lyricWindow: BrowserWindow | null;
    miniModeWindow: BrowserWindow | null;

    /**
     * 获取主窗口的引用
     */
    getMainWindow(): BrowserWindow;

    /**
     * 获取所有扩展窗口的引用
     */
    getExtensionWindows(): BrowserWindow[];

    /**
     * 获取所有窗口的引用
     */
    getAllWindows(): BrowserWindow[];

    /**
     * 为特定事件类型注册监听器
     */
    on<T extends keyof IWindowEvents>(event: T, listener: (data: IWindowEvents[T]) => void): void;


    /**
     * 显示主窗口
     */
    showMainWindow(): void;

    /**
     * 关闭主窗口
     */
    closeMainWindow(): void;


    /**
     * 显示歌词窗口
     */
    showLyricWindow(): void;

    /**
     * 关闭歌词窗口
     */
    closeLyricWindow(): void;


    /**
     * 显示迷你模式窗口
     */
    showMiniModeWindow(): void;

    /**
     * 关闭迷你模式窗口
     */
    closeMiniModeWindow(): void;
}
