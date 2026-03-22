/** 备份文件完整结构 */
export interface IBackupData {
    version: 1;
    createdAt: number;
    musicSheets: IBackupSheet[];
}

/** 备份中的单个歌单 */
export interface IBackupSheet {
    id: string;
    title: string;
    musicList: IMusic.IMusicItem[];
}

/** 恢复模式 */
export type RestoreMode = 'append' | 'overwrite';

/** 恢复进度事件 */
export interface IBackupProgress {
    /** 当前处理到第几个歌单（1-based） */
    current: number;
    /** 歌单总数 */
    total: number;
    /** 当前歌单标题 */
    sheetTitle?: string;
}

/** 操作结果 */
export interface IBackupResult {
    success: boolean;
    error?: string;
    sheetsCount?: number;
    songsCount?: number;
}

/**
 * musicSheet 模块向 backup 模块提供的 DI 适配器。
 * 封装了歌单导出和导入操作，主进程内直接调用，不经 IPC。
 */
export interface IBackupProvider {
    /** 获取所有可导出歌单的元数据（排除 system 类型） */
    getExportableSheets(): Array<{ id: string; title: string }>;
    /** 获取指定歌单内全量 raw 数据 */
    getSheetMusicRaw(sheetId: string): IMusic.IMusicItem[];
    /**
     * 导入歌单数据。
     * @param sheets - 待导入的歌单数组
     * @param mode - 'append' | 'overwrite'
     * @param onProgress - 进度回调（按歌单粒度）
     */
    importSheets(
        sheets: IBackupSheet[],
        mode: RestoreMode,
        onProgress?: (current: number, total: number, sheetTitle: string) => void,
    ): { sheetsCount: number; songsCount: number };
}
