import type { IMusicItemSlim } from '@appTypes/infra/playlist';

/** 本地音频文件的编码参数（缺失项表示未知） */
export interface IAudioFormat {
    /** 编码短名，如 FLAC、MP3、AAC、ALAC */
    codec?: string;
    lossless?: boolean;
    /** 码率（bps） */
    bitrate?: number;
    /** 采样率（Hz） */
    sampleRate?: number;
    bitsPerSample?: number;
    channels?: number;
}

/**
 *
 * 继承 IMusicItemSlim 的 7 个字段（platform, id, title, artist, album, duration, artwork），
 * 其中 `id` 对应 DB 列 `music_id`，在扫描时确定：
 * - App 下载的歌 → 原始 id（通过 download_path 反查）
 * - 纯本地歌 → filePath
 */
export interface ILocalMusicItem extends IMusicItemSlim {
    /** 文件绝对路径（DB 主键） */
    filePath: string;
    /** 所在文件夹路径 */
    folder: string;
    /** 文件大小（字节） */
    fileSize: number | null;
    /** 文件修改时间（ms timestamp） */
    fileMtime: number | null;
    /** 所属扫描文件夹 ID */
    scanFolderId: string;
    /** 入库时间 */
    createdAt: number;
    /** 编码短名；NULL 表示尚未解析，空字符串表示已解析但未识别 */
    codec: string | null;
    lossless: number | null;
    bitrate: number | null;
    sampleRate: number | null;
    bitsPerSample: number | null;
    channels: number | null;
}

/** 扫描文件夹 */
export interface IScanFolder {
    id: string;
    folderPath: string;
    lastScanAt: number | null;
    createdAt: number;
}

/** 扫描进度 */
export interface IScanProgress {
    phase: 'discovering' | 'diffing' | 'parsing' | 'done';
    scanned: number;
    total: number;
    current?: string;
}

/** 扫描结果摘要 */
export interface IScanResult {
    added: number;
    updated: number;
    removed: number;
    unchanged: number;
    elapsed: number;
}

/** 文件信息（扫描引擎产出） */
export interface IFileInfo {
    filePath: string;
    size: number;
    mtime: number;
}

/** 目录发现结果 */
export interface IDiscoverResult {
    files: IFileInfo[];
    /** 读取失败的目录（无权限、设备已断开等） */
    unreadableDirs: string[];
}

/** 增量 diff 结果 */
export interface IDiffResult {
    added: IFileInfo[];
    changed: IFileInfo[];
    removed: string[];
    unchanged: number;
    /** 未变更但尚未解析编码参数（codec 为 NULL）的文件路径 */
    missingFormat: string[];
}
