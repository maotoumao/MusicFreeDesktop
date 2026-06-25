/**
 * TrackPlayer 模块内部类型
 */
import type LyricParser from '@common/lyricParser';
import type { IParsedLrcItem } from '@common/lyricParser';

export interface ICurrentLyric {
    parser?: LyricParser;
    currentLrc?: IParsedLrcItem;
}

export interface IPlayOptions {
    restartOnSameMedia?: boolean;
}

/** resolveSource 的可选行为 */
export interface IResolveSourceOptions {
    /** 为 true 时，仅在本地已下载文件的音质与目标音质一致时才使用本地文件（切换音质场景） */
    requireQualityMatch?: boolean;
}
