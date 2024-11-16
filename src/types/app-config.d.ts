interface _IAppConfig {
    "$schema-version": number;
    "normal.closeBehavior": "exit_app" | "minimize";
    "normal.maxHistoryLength": number;
    "normal.checkUpdate": boolean;
    "normal.taskbarThumb": "window" | "artwork";
    "normal.musicListColumnsShown": Array<"duration" | "platform">;
    "normal.language": string;

    /** 歌单内搜索区分大小写 */
    "playMusic.caseSensitiveInSearch": boolean;
    /** 默认播放音质 */
    "playMusic.defaultQuality": IMusic.IQualityKey;
    /** 默认播放音质缺失时 */
    "playMusic.whenQualityMissing": "higher" | "lower" | "skip";
    /** 双击音乐列表时 */
    "playMusic.clickMusicList": "normal" | "replace";
    /** 播放失败时 */
    "playMusic.playError": "pause" | "skip";
    /** 输出设备 */
    "playMusic.audioOutputDevice": MediaDeviceInfo | null;
    /** 设备变化时 */
    "playMusic.whenDeviceRemoved": "pause" | "play";

    /** [darwin only] 显示状态栏歌词 */
    "lyric.enableStatusBarLyric": boolean;
    /** 显示桌面歌词 */
    "lyric.enableDesktopLyric": boolean;
    /** 桌面歌词置顶 */
    "lyric.alwaysOnTop": boolean;
    /** 锁定桌面歌词 */
    "lyric.lockLyric": boolean;
    /** 字体 */
    "lyric.fontData": FontData;
    /** 字体颜色 */
    "lyric.fontColor": string;
    /** 字体大小 */
    "lyric.fontSize": number;
    /** 描边颜色 */
    "lyric.strokeColor": string;

    /** 是否启用本地快捷键 */
    "shortCut.enableLocal": boolean;
    /** 是否启用全局快捷键 */
    "shortCut.enableGlobal": boolean;
    /** 快捷键映射 */
    "shortCut.shortcuts": Record<
        | "play/pause"
        | "skip-previous"
        | "skip-next"
        | "toggle-desktop-lyric"
        | "volume-up"
        | "volume-down"
        | "like/dislike",
        {
            local?: string[] | null;
            global?: string[] | null;
        }
    >;

    /** 下载路径 */
    "download.path": string;
    /** 默认下载音质 */
    "download.defaultQuality": IMusic.IQualityKey;
    /** 默认下载音质缺失时 */
    "download.whenQualityMissing": "higher" | "lower";
    /** 最多同时下载 */
    "download.concurrency": number;

    /** 是否自动升级插件 */
    "plugin.autoUpdatePlugin": boolean;
    /** 是否不检测插件版本 */
    "plugin.notCheckPluginVersion": boolean;

    /** 是否启用代理 */
    "network.proxy.enabled": boolean;
    "network.proxy.host": string;
    "network.proxy.port": string;
    "network.proxy.username": string;
    "network.proxy.password": string;

    /** 恢复歌单时行为 */
    "backup.resumeBehavior": "append" | "overwrite";
    /** URL */
    "backup.webdav.url": string;
    /** 用户名 */
    "backup.webdav.username": string;
    /** 密码 */
    "backup.webdav.password": string;

    /** 本地音乐配置 */
    "localMusic.watchDir": string[];

    /** 不需要用户配置的数据 */
    "private.lyricWindowPosition": ICommon.IPoint;

    "private.minimodeWindowPosition": ICommon.IPoint;

    "private.pluginMeta": Record<string, IPlugin.IPluginMeta>;

    "private.minimode": boolean;

}

type PartialOrNull<T> = { [P in keyof T]?: T[P] | null };
export type IAppConfig = PartialOrNull<_IAppConfig>;
export type IAppConfigKey = keyof IAppConfig;
