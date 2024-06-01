import { IAppConfig } from "../shared/app-config/type";

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

type IShortCutKeys = keyof IAppConfig["shortCut"]["shortcuts"];
export const shortCutKeys: IShortCutKeys[] = [
  "play/pause",
  "skip-next",
  "skip-previous",
  "volume-up",
  "volume-down",
  "toggle-desktop-lyric",
  "like/dislike",
];

// 快捷键列表对应的事件
export const shortCutKeysEvts: Record<IShortCutKeys, keyof IEventType.IEvents> =
  {
    "play/pause": "TOGGLE_PLAYER_STATE",
    "skip-next": "SKIP_NEXT",
    "skip-previous": "SKIP_PREVIOUS",
    "volume-down": "VOLUME_DOWN",
    "volume-up": "VOLUME_UP",
    "toggle-desktop-lyric": "TOGGLE_DESKTOP_LYRIC",
    "like/dislike": "TOGGLE_LIKE",
  };

/** 下载状态 */
export enum DownloadState {
  /** 等待中 */
  WAITING,
  /** 下载中 */
  PENDING,
  /** 失败 */
  ERROR,
  /** 下载完成 */
  DONE,
}

// 主题包链接
export const themePackStoreBaseUrl = [
  "https://raw.githubusercontent.com/maotoumao/MusicFreeThemePacks/master/", //github
  "https://cdn.jsdelivr.net/gh/maotoumao/MusicFreeThemePacks@master/",
  "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/", // gitee
];
