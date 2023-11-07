interface Window {
    fs: typeof import('../preload/internal/fs-delegate').default;
    themepack: typeof import('../preload/internal/themepack').default;
    globalData: IGlobalData,
    path: typeof import("node:path");
    rimraf: typeof import('rimraf').rimraf;
    utils: typeof import('../preload/internal/utils').default;
    /** 向拓展窗口广播数据 */
    mainPort: typeof import('../preload/internal/main-port').default;
    extPort: typeof import('../preload/internal/ext-port').default;
}

interface IGlobalData {
    /** 版本号 */
    appVersion: string;
    workersPath: {
        /** 下载器worker */
        downloader: string;
        /** 本地文件监听器worker */
        localFileWatcher: string;
    },
    appPath: {
        userData: string;
        temp: string;
        downloads: string;
    }
    platform: NodeJS.Platform
}