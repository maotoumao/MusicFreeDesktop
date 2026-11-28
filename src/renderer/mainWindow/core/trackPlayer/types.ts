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
    /** 调用方已持有的完整条目；入队写入尚未落库时代替数据库查询结果 */
    musicItem?: IMusic.IMusicItem;
}

/** resolveSource 的可选行为 */
export interface IResolveSourceOptions {
    /** 为 true 时，仅在本地已下载文件的音质与目标音质一致时才使用本地文件（切换音质场景） */
    requireQualityMatch?: boolean;
}
