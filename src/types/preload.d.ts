interface Window {
    fs: typeof import('../preload/internal/fs-delegate').default;
    globalData: IGlobalData
}

interface IGlobalData {
    /** 版本号 */
    appVersion: string;
}