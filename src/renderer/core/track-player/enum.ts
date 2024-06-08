import LyricParser, { IParsedLrcItem } from "@/renderer/utils/lyric-parser";

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

/** 错误信息 */
export enum ErrorReason {
  /** 音源为空 */
  EmptyResource,
}

export interface ICurrentLyric {
  parser?: LyricParser;
  currentLrc?: IParsedLrcItem;
}

/** 播放器事件 */
export enum TrackPlayerEvent {
  /** 播放失败 */
  Error = "play-back-error",
  /** 播放状态改变 */
  StateChanged = "play-state-changed",
  /** 进度更新 */
  ProgressChanged = "time-updated",
  /** 音乐改变 */
  MusicChanged = "music-changed",
  /** 音量改变 */
  VolumeChanged = "volume-changed",
  /** 速度改变 */
  SpeedChanged = "speed-changed",
  /** 播放结束 */
  PlayEnd = "play-end",
  /** 获取当前歌词 */
  NeedRefreshLyric = "need-refresh-lyric",
  /** modechange */
  RepeatModeChanged = "repeat-mode-changed",
  /** 歌词改变 */
  CurrentLyricChanged = "current-lyric-changed",
  /** 整体歌词改变 */
  LyricChanged = "lyric-changed",
}

/** 事件参数 */
export interface TrackPlayerEventParams {
  [TrackPlayerEvent.Error]: ErrorReason;
  [TrackPlayerEvent.StateChanged]: PlayerState;
  [TrackPlayerEvent.ProgressChanged]: CurrentTime;
  [TrackPlayerEvent.PlayEnd]: undefined;
  [TrackPlayerEvent.NeedRefreshLyric]: boolean;
  [TrackPlayerEvent.SpeedChanged]: number;
  [TrackPlayerEvent.VolumeChanged]: number;
  [TrackPlayerEvent.MusicChanged]: IMusic.IMusicItem | null;
  [TrackPlayerEvent.RepeatModeChanged]: RepeatMode;
  [TrackPlayerEvent.CurrentLyricChanged]: ICurrentLyric["currentLrc"];
  [TrackPlayerEvent.LyricChanged]: LyricParser;
}

/** 当前时间信息 */
export interface CurrentTime {
  currentTime: number;
  duration: number;
}
