interface Window {
    fs: typeof import('../preload/internal/fs-delegate').default;
    themepack: typeof import('../preload/internal/themepack').default;
    globalData: IGlobalData,
}

interface IGlobalData {
    /** 版本号 */
    appVersion: string;
}