/** per-item 附加元数据 */
export interface IMediaMeta {
    /** 下载信息（downloadManager 写入） */
    downloadData?: {
        /** 本地文件路径 */
        path: string;
        /** 下载音质 */
        quality: IMusic.IQualityKey;
    };
    /** 关联歌词（用户手动绑定 + 歌词文本缓存） */
    associatedLyric?: {
        /** 关联的歌词来源歌曲 */
        musicItem: IMusic.IMusicItem;
        /** 缓存的歌词文本 */
        rawLrc?: string;
        /** 翻译歌词 */
        translation?: string;
    };
    /** 用户设置的歌词时间偏移（秒），正值歌词提前，负值延后 */
    lyricOffset?: number;
}

/** setMeta patch 类型：null 表示删除该字段（RFC 7396） */
export type MediaMetaPatch = {
    [K in keyof IMediaMeta]?: IMediaMeta[K] | null;
};

/** meta 变更事件载荷 */
export interface IMediaMetaChangeEvent {
    platform: string;
    musicId: string;
    meta: IMediaMeta | null;
}

/**
 * mediaMeta 统一 DI 接口。
 *
 * 各消费模块（downloadManager / localMusic / pluginManager）
 * 注入同一个 provider 实例，按需使用其中的方法。
 */
export interface IMediaMetaProvider {
    /** 更新 meta（RFC 7396 JSON Merge Patch） */
    setMeta(platform: string, musicId: string, patch: MediaMetaPatch): void;

    /** 查询单条歌曲的下载信息 */
    getDownloadData(
        platform: string,
        musicId: string,
    ): { path: string; quality: IMusic.IQualityKey } | null;

    /** 获取所有已下载歌曲的下载信息 */
    getAllDownloaded(): Array<{
        platform: string;
        musicId: string;
        path: string;
        quality: IMusic.IQualityKey;
    }>;

    /** 通过下载路径反查原始歌曲的 platform + musicId */
    getMetaByDownloadPath(filePath: string): { platform: string; musicId: string } | null;

    /** 获取关联歌词信息 */
    getAssociatedLyric(platform: string, musicId: string): IMediaMeta['associatedLyric'] | null;
}
