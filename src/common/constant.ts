export const internalSerializeKey = "$";
export const internalDataSymbol = Symbol.for("internal");
// 加入播放列表/歌单的时间
export const timeStampSymbol = Symbol.for("time-stamp");
// 加入播放列表的辅助顺序
export const sortIndexSymbol = Symbol.for("sort-index");
/** 歌曲引用次数 */
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
  ".ape",
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
