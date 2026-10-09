import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';

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

/** 增量 diff 结果 */
export interface IDiffResult {
    added: IFileInfo[];
    changed: IFileInfo[];
    removed: string[];
    unchanged: number;
}
