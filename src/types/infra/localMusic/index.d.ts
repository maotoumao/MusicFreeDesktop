import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';

/** 音频文件的编码信息；未知字段保持缺省。 */
export interface IAudioFormat {
    codec?: string;
    container?: string;
    lossless?: boolean;
    /** bits/sec */
    bitrate?: number;
    /** Hz */
    sampleRate?: number;
    bitsPerSample?: number;
    numberOfChannels?: number;
    /** seconds */
    duration?: number;
}

/** IPC 可传输的标签值；图片等二进制用 { type: 'binary', byteLength } 描述。 */
export type MetadataValue =
    | string
    | number
    | boolean
    | null
    | MetadataValue[]
    | { [key: string]: MetadataValue };

export interface ILocalMusicMetadata {
    filePath: string;
    fileSize: number;
    /** ms timestamp，保留文件系统精度 */
    fileMtime: number;
    format: IAudioFormat;
    common: Record<string, MetadataValue>;
    native: Record<string, MetadataValue>;
    /** 首张封面的 data URI */
    artwork?: string;
    /** 数据库展示标签，与文件原始标签分开。 */
    libraryTags?: { title: string; artist: string; album: string };
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
    format?: IAudioFormat | null;
    /** format 对应的精确 mtime，不改变扫描的整数 mtime 比较约定。 */
    formatFileMtime?: number;
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
    failed?: number;
    failures?: IScanFailure[];
}

export interface IScanFailure {
    filePath: string;
    reason: string;
}

/** 扫描结果摘要 */
export interface IScanResult {
    added: number;
    updated: number;
    removed: number;
    unchanged: number;
    elapsed: number;
    failed: number;
    failures: IScanFailure[];
}

/** 文件信息（扫描引擎产出） */
export interface IFileInfo {
    filePath: string;
    size: number;
    mtime: number;
}

/** 增量 diff 结果 */
export interface IDiffResult {
    added: IFileInfo[];
    changed: IFileInfo[];
    removed: string[];
    unchanged: number;
}
