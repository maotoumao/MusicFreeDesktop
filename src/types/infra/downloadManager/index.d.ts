import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
import type { IGetMediaSourceResult } from '@appTypes/infra/pluginManager';

/** 下载任务状态 */
export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'error';

/** 活跃下载任务状态（completed 后从 activeTaskMap 中移除，不会出现） */
export type ActiveDownloadStatus = Exclude<DownloadStatus, 'completed'>;

/** 下载任务（与 download_tasks 表结构对应） */
export interface IDownloadTask {
    /** 任务唯一 ID */
    id: string;
    /** 音乐来源平台 */
    platform: string;
    /** 音乐 ID */
    musicId: string;
    /** 歌曲标题（冗余存储，方便展示） */
    title: string;
    /** 歌手（冗余存储） */
    artist: string;
    /** 专辑（冗余存储） */
    album: string;
    /** 目标音质 */
    quality: IMusic.IQualityKey;
    /** 当前状态 */
    status: DownloadStatus;
    /** 最终保存路径 */
    filePath: string | null;
    /** 临时文件路径（.downloading 后缀） */
    tempPath: string | null;
    /** 总字节数（首次请求 Content-Length 后填入） */
    totalBytes: number;
    /** 已下载字节数 */
    downloadedBytes: number;
    /** 缓存的媒体源信息（JSON 字符串） */
    mediaSource: string | null;
    /** 原始歌曲信息（JSON 字符串，下载完成后写入 music_items） */
    musicItemRaw: string | null;
    /** 错误信息 */
    error: string | null;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
}

/** 下载任务（DB 行原始格式，列名使用 snake_case） */
export interface IDownloadTaskRow {
    id: string;
    platform: string;
    music_id: string;
    title: string;
    artist: string;
    album: string;
    quality: string;
    status: string;
    file_path: string | null;
    temp_path: string | null;
    total_bytes: number;
    downloaded_bytes: number;
    media_source: string | null;
    music_item_raw: string | null;
    error: string | null;
    created_at: number;
    updated_at: number;
}

/** 下载进度（高频广播用，精简字段） */
export interface IDownloadProgress {
    id: string;
    downloadedBytes: number;
    totalBytes: number;
    /** 下载速度 bytes/s */
    speed: number;
}

/** 添加下载任务参数 */
export interface IAddDownloadParams {
    /** 歌曲数据（完整或精简均可，主进程会自动解析 slim → full） */
    musicItem: IMusic.IMusicItem | IMusicItemSlim;
    /** 指定音质，默认取 download.defaultQuality */
    quality?: IMusic.IQualityKey;
}

/** 下载任务状态变更事件 */
export interface IDownloadTaskEvent {
    task: IDownloadTask;
    /** 变更类型 */
    type: 'added' | 'status-changed' | 'completed' | 'error' | 'removed';
}

// ─── DI 依赖接口 ───

/** pluginManager 窄接口 */
export interface IPluginManagerForDownload {
    getMediaSource(
        musicItem: IMusic.IMusicItem,
        quality: IMusic.IQualityKey,
        qualityOrder: IMusic.IQualityKey[],
        qualityFallbackOrder: 'higher' | 'lower',
    ): Promise<IGetMediaSourceResult | null>;
}

/** 已下载歌单操作接口 */
export interface IDownloadedSheetProvider {
    /** 下载完成 → upsert music_items + 加入 __downloaded__ 歌单 */
    addMusicToDownloaded(musicItem: IMusic.IMusicItem): void;
    /** 删除下载(含文件) → 从 __downloaded__ 歌单移除 */
    removeFromDownloaded(platform: string, musicId: string): void;
}
