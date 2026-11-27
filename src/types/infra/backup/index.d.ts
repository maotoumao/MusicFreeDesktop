/** 备份文件完整结构 */
export interface IBackupData {
    version: 1;
    createdAt: number;
    /** 产出端信息（跨端备份协议 origin 字段）；旧备份没有 */
    origin?: IBackupOrigin;
    musicSheets: IBackupPlaylist[];
}

/** 备份产出端信息 */
export interface IBackupOrigin {
    /** 'android' | 'ios' | 'desktop' */
    platform?: string;
    appVersion?: string;
    /** 产出端的安装标识，用于判断本地歌曲能否在本机恢复 */
    installationId?: string;
}

/** 备份中的单个歌单 */
export interface IBackupPlaylist {
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
    /** 恢复时跳过的本地歌曲数（来自其他安装，或文件在本机不存在） */
    localIgnored?: number;
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
        sheets: IBackupPlaylist[],
        mode: RestoreMode,
        onProgress?: (current: number, total: number, sheetTitle: string) => void,
    ): { sheetsCount: number; songsCount: number };
}
