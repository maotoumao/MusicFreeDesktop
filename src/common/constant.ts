import {IAppConfig} from "@/types/app-config";
import {ICommand} from "@shared/message-bus/type";

export const internalDataKey = "$";
export const internalDataSymbol = Symbol.for("internal");
// 加入播放列表/歌单的时间
export const timeStampSymbol = Symbol.for("time-stamp");
// 加入播放列表的辅助顺序
export const sortIndexSymbol = Symbol.for("sort-index");
/**
 * 歌曲引用次数
 * TODO: 没必要算引用 如果真有需要直接取异或就可以了
 */
export const musicRefSymbol = "$$ref";

/** 本地存储路径 */
export const localFilePathSymbol = Symbol.for("local-file-path");
export const localPluginName = "本地";
export const localPluginHash = "本地";

export const supportedMediaType = [
    "music",
    "album",
    "artist",
    "sheet",
] as const;

export const rem = 13;

export enum RequestStateCode {
    /** 空闲 */
    IDLE = 0b00000000,
    PENDING_FIRST_PAGE = 0b00000010,
    LOADING = 0b00000010,
    /** 检索中 */
    PENDING_REST_PAGE = 0b00000011,
    /** 部分结束 */
    PARTLY_DONE = 0b00000100,
    /** 全部结束 */
    FINISHED = 0b0001000,
    /** 出错了 */
    ERROR = 0b10000000,
}

/** 音质列表 */
export const qualityKeys: IMusic.IQualityKey[] = [
    "low",
    "standard",
    "high",
    "super",
];

export const supportLocalMediaType = [
    ".mp3",
    ".mp4",
    ".m4s",
    ".flac",
    ".wma",
    ".wav",
    ".m4a",
    ".ogg",
    ".acc",
    ".aac",
    // ".ape",
    ".opus",
];

export const toastDuration = {
    short: 1000,
    long: 2500,
};

export const defaultFont = {
    fullName: "默认",
    family: "",
    postscriptName: "",
    style: "",
};

type IShortCutKeys = keyof IAppConfig["shortCut.shortcuts"];
export const shortCutKeys: IShortCutKeys[] = [
    "play/pause",
    "skip-next",
    "skip-previous",
    "volume-up",
    "volume-down",
    "toggle-desktop-lyric",
    "like/dislike",
];

// 快捷键列表对应的指令
export const shortCutKeysCommands: Record<IShortCutKeys, keyof ICommand> =
    {
        "play/pause": "TogglePlayerState",
        "skip-next": "SkipToNext",
        "skip-previous": "SkipToPrevious",
        "volume-down": "VolumeDown",
        "volume-up": "VolumeUp",
        "toggle-desktop-lyric": "ToggleDesktopLyric",
        "like/dislike": "ToggleFavorite",
    };

// 主进程的Resource
export enum ResourceName {
    SKIP_LEFT_ICON = "skip-left.png",
    SKIP_RIGHT_ICON = "skip-right.png",
    PAUSE_ICON = "pause.png",
    PLAY_ICON = "play.png",
    DEFAULT_ALBUM_COVER_IMAGE = "album-cover.jpeg",
    LOGO_IMAGE = "logo.png"

}

/** 下载状态 */
export enum DownloadState {
    /** 空闲状态 */
    NONE = "NONE",
    /** 排队等待中 */
    WAITING = "WAITING",
    /** 下载中 */
    DOWNLOADING = "DOWNLOADING",
    /** 失败 */
    ERROR = "ERROR",
    /** 下载完成 */
    DONE = "DONE",
}

// 主题更新链接
export const themePackStoreBaseUrl = [
    "https://raw.githubusercontent.com/maotoumao/MusicFreeThemePacks/master/", //github
    "https://cdn.jsdelivr.net/gh/maotoumao/MusicFreeThemePacks@master/",
    "https://dev.azure.com/maotoumao/MusicFree/_apis/git/repositories/MusicFreeThemePacks/items?scopePath=/.publish/publish.json&api-version=6.0", // azure
];

export const appUpdateSources = [
    "https://gitee.com/maotoumao/MusicFreeDesktop/raw/master/release/version.json",
    "https://raw.githubusercontent.com/maotoumao/MusicFreeDesktop/master/release/version.json",
    "https://cdn.jsdelivr.net/gh/maotoumao/MusicFreeDesktop@master/release/version.json",
];

export enum TrackPlayerSyncType {
    SyncPlayerState = "SyncPlayerState",
    MusicChanged = "MusicChanged",
    PlayerStateChanged = "PlayerStateChanged",
    RepeatModeChanged = "RepeatModeChanged",
    LyricChanged = "LyricChanged",
    CurrentLyricChanged = "CurrentLyricChanged",
    ProgressChanged = "ProgressChanged",
}

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
    Shuffle = "shuffle",
    /** 播放队列 */
    Queue = "queue-repeat",
    /** 单曲循环 */
    Loop = "loop",
}


/** 窗口类型 */
export enum WindowType {
    MAIN = "MAIN",
    LYRIC = "LYRIC",
    MINIMODE = "MINIMODE",
}

export enum WindowRole {
    MAIN = "MAIN",
    SLAVE = "SLAVE",
}

export const CommonConst = {
    /** 新建歌单名称长度限制 */
    NEW_SHEET_NAME_LENGTH_LIMIT: 120,
}
