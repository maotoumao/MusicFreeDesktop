import type { IShortCutMap } from '@appTypes/infra/shortCut';
import type { ISize, IPoint } from '../windowDrag';

/** 可序列化的音频输出设备信息（替代不可序列化的 MediaDeviceInfo） */
export interface IAudioOutputDevice {
    deviceId: string;
    label: string;
    groupId: string;
}

interface _IAppConfig {
    '$schema-version': number;
    'normal.closeBehavior': 'exit_app' | 'minimize';
    'normal.maxHistoryLength': number;
    'normal.checkUpdate': boolean;
    'normal.taskbarThumb': 'window' | 'artwork';
    'normal.musicListHideColumns': Array<'duration' | 'platform'>;
    /** [win10+] 使用自定义原生托盘菜单 */
    'normal.useCustomTrayMenu': boolean;
    'normal.language': string;

    /** 歌单内搜索区分大小写 */
    'playMusic.caseSensitiveInSearch': boolean;
    /** 默认播放音质 */
    'playMusic.defaultQuality': IMusic.IQualityKey;
    /** 默认播放音质缺失时 */
    'playMusic.whenQualityMissing': 'higher' | 'lower' | 'skip';
    /** 双击音乐列表时 */
    'playMusic.clickMusicList': 'normal' | 'replace';
    /** 播放失败时 */
    'playMusic.playError': 'pause' | 'skip';
    /** 输出设备 */
    'playMusic.audioOutputDevice': IAudioOutputDevice | null;
    /** 设备变化时 */
    'playMusic.whenDeviceRemoved': 'pause' | 'play';

    /** [darwin only] 显示状态栏歌词 */
    'lyric.enableStatusBarLyric': boolean;
    /** 显示桌面歌词 */
    'lyric.enableDesktopLyric': boolean;
    /** 桌面歌词置顶 */
    'lyric.alwaysOnTop': boolean;
    /** 锁定桌面歌词 */
    'lyric.lockLyric': boolean;
    /** 字体 */
    'lyric.fontData': FontData;
    /** 字体颜色 */
    'lyric.fontColor': string;
    /** 字体大小 */
    'lyric.fontSize': number;
    /** 描边颜色 */
    'lyric.strokeColor': string;

    /** 是否启用本地快捷键 */
    'shortCut.enableLocal': boolean;
    /** 是否启用全局快捷键 */
    'shortCut.enableGlobal': boolean;
    /** 快捷键映射 */
    'shortCut.shortcuts': IShortCutMap;

    /** 下载路径 */
    'download.path': string;
    /** 默认下载音质 */
    'download.defaultQuality': IMusic.IQualityKey;
    /** 默认下载音质缺失时 */
    'download.whenQualityMissing': 'higher' | 'lower';
    /** 最多同时下载 */
    'download.concurrency': number;

    /** 是否自动升级插件 */
    'plugin.autoUpdatePlugin': boolean;
    /** 是否不检测插件版本 */
    'plugin.notCheckPluginVersion': boolean;

    /** 是否启用代理 */
    'network.proxy.enabled': boolean;
    'network.proxy.host': string;
    'network.proxy.port': string;
    'network.proxy.username': string;
    'network.proxy.password': string;

    /** 恢复歌单时行为 */
    'backup.resumeBehavior': 'append' | 'overwrite';
    /** URL */
    'backup.webdav.url': string;
    /** 用户名 */
    'backup.webdav.username': string;
    /** 密码 */
    'backup.webdav.password': string;

    /** 本地音乐：扫描目录列表（由 scan_folders 表管理，此项已废弃） */
    'localMusic.watchDir': string[];
    /** 本地音乐：排除路径列表（绝对路径，子路径也会被排除） */
    'localMusic.excludedPaths': string[];
    /** 本地音乐：最短时长过滤（秒），低于此值的文件在渲染进程侧过滤 */
    'localMusic.minDurationSec': number;

    /** 不需要用户配置的数据 */
    'private.mainWindowSize': ISize;
    'private.lyricWindowPosition': IPoint;
    'private.lyricWindowSize': ISize;

    'private.minimodeWindowPosition': IPoint;

    'private.pluginMeta': Record<string, IPlugin.IPluginMeta>;

    /** 插件订阅源列表 */
    'private.pluginSubscription': Array<{ name: string; srcUrl: string }>;
}

type PartialOrNull<T> = { [P in keyof T]?: T[P] | null };
export type IAppConfig = PartialOrNull<_IAppConfig>;
export type IAppConfigKey = keyof IAppConfig;

export type ConfigSource = 'main' | 'renderer';

/**
 * appConfig 模块对外暴露的只读能力接口。
 *
 * 用于其他 infra 模块通过 setup 注入来消费配置，
 * 而无需直接 import appConfig 单例。
 * main 和 renderer 侧均使用此接口。
 */
export interface IAppConfigReader {
    getConfig(): IAppConfig;
    getConfigByKey<T extends keyof IAppConfig>(key: T): IAppConfig[T];
    onConfigUpdated(
        cb: (patch: IAppConfig, config: IAppConfig, source: ConfigSource) => void,
    ): void;
    offConfigUpdated(
        cb: (patch: IAppConfig, config: IAppConfig, source: ConfigSource) => void,
    ): void;
}
