export {};

declare global {
    /** 编译时常量：开发模式为 true，生产构建为 false（支持 tree-shaking） */
    const __DEV__: boolean;

    var globalContext: IGlobalContext;

    interface IGlobalContext {
        /** 版本号 */
        appVersion: string;
        appPath: {
            userData: string;
            temp: string;
            /** 默认下载路径（fallback: 系统下载 → 系统音乐 → 应用数据目录/downloads） */
            defaultDownloadPath: string;
            /** 公用打包资源地址 */
            res: string;
        };
        platform: NodeJS.Platform;
        /** 是否为 Windows 10 或更高版本 */
        isWin10OrAbove: boolean;
    }

    interface Window {
        globalContext: IGlobalContext;
        /** Local Font Access API */
        queryLocalFonts?: () => Promise<FontData[]>;
    }

    /** Local Font Access API — 本地字体元数据 */
    interface FontData {
        readonly family: string;
        readonly fullName: string;
        readonly postscriptName: string;
        readonly style: string;
    }

    // ── Navigation API (Chromium 实验性 API，Electron 中可用) ──

    interface Navigation extends EventTarget {
        readonly canGoBack: boolean;
        readonly canGoForward: boolean;
        back(): void;
        forward(): void;
    }

    var navigation: Navigation;

    /** Electron 扩展：File 对象包含本地绝对路径 */
    interface File {
        readonly path: string;
    }
}
