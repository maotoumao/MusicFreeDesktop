import LyricParser, { IParsedLrcItem } from "@/renderer/utils/lyric-parser";

/** 错误信息 */
export enum ErrorReason {
    /** 音源为空 */
    EmptyResource,
    /** 不支持的类型 */
    UnsupportedResource,
}

export interface ICurrentLyric {
    parser?: LyricParser;
    currentLrc?: IParsedLrcItem;
}

/** 播放器事件 */
export enum PlayerEvents {
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
    // PlayEnd = "play-end",
    /** modechange */
    RepeatModeChanged = "repeat-mode-changed",
    /** 歌词改变 */
    CurrentLyricChanged = "current-lyric-changed",
    /** 整体歌词改变 */
    LyricChanged = "lyric-changed",
}


/** 当前时间信息 */
export interface CurrentTime {
    currentTime: number;
    duration: number;
}
