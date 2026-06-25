/**
 * 全局通用常量
 */

/** 音质键名，从低到高排列 */
export const QUALITY_KEYS: IMusic.IQualityKey[] = ['low', 'standard', 'high', 'super'];

/** 播放器状态 */
export enum PlayerState {
    /** 无音频 */
    None,
    /** 播放中 */
    Playing,
    /** 暂停 */
    Paused,
    /** 缓冲中 */
    Buffering,
}

/** 播放模式 */
export enum RepeatMode {
    /** 随机 */
    Shuffle = 'shuffle',
    /** 播放队列 */
    Queue = 'queue-repeat',
    /** 单曲循环 */
    Loop = 'loop',
}

/** RepeatMode 循环切换顺序：Queue → Shuffle → Loop → Queue */
export const REPEAT_MODE_NEXT: Record<RepeatMode, RepeatMode> = {
    [RepeatMode.Queue]: RepeatMode.Shuffle,
    [RepeatMode.Shuffle]: RepeatMode.Loop,
    [RepeatMode.Loop]: RepeatMode.Queue,
};

/** 日志级别 */
export enum LogLevel {
    Debug = 'debug',
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
}

// 主进程的Resource
export enum ResourceName {
    SKIP_LEFT_ICO = 'skip-left.ico',
    SKIP_RIGHT_ICO = 'skip-right.ico',
    PAUSE_ICO = 'pause.ico',
    PLAY_ICO = 'play.ico',
    LOGO_ICO = 'logo.ico',
    DEFAULT_ALBUM_COVER_IMAGE = 'album-cover.jpeg',
    LOGO_IMAGE = 'logo.png',
}

/**
 * RequestStatus — 通用请求/加载状态枚举
 *
 * 用于网络请求、页面加载、分页等所有涉及异步状态的场景。
 * 所有 UI 组件（StatusPlaceholder、ListFooter 等）统一消费此枚举。
 */
export enum RequestStatus {
    /** 初始态，尚未发起请求 */
    Idle = 'idle',
    /** 请求中 */
    Pending = 'pending',
    /** 请求成功完成 */
    Done = 'done',
    /** 请求失败 */
    Error = 'error',
}

/** 播放错误原因 */
export enum ErrorReason {
    /** 空资源（无 URL） */
    EmptyResource,
    /** 不支持的资源格式 */
    UnsupportedResource,
    /** 恢复播放失败（启动时） */
    HydrationFailed,
}

/** 标记 slim 对象的内部 key（值为 '$slim'） */
export const INTERNAL_SLIM_KEY = '$slim';

/** 支持的音频文件扩展名（小写，含点号） */
export const SUPPORTED_AUDIO_EXTS = new Set([
    '.mp3',
    '.mp4',
    '.m4s',
    '.m4a',
    '.flac',
    '.wav',
    '.ogg',
    '.aac',
    '.wma',
    '.ape',
    '.opus',
]);

/** 本地插件平台名 */
export const LOCAL_PLUGIN_NAME = '本地';

/** 本地插件哈希 */
export const LOCAL_PLUGIN_HASH = '本地';
