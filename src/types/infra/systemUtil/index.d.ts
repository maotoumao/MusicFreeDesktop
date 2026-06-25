/**
 * 版本更新信息
 */
export interface IUpdateInfo {
    /** 当前应用版本号 */
    version: string;
    /** 如果有可用更新，包含更新详情 */
    update?: {
        /** 新版本号 */
        version: string;
        /** 更新日志 */
        changeLog?: string[];
        /** 下载链接 */
        download?: string[];
    };
}
