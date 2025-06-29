// 数据模型
declare namespace IDataBaseModel {
    export interface IMusicSheetModel {
        platform: string;
        id: string;
        /** 标题 */
        title: string;
        /** 封面图 */
        artwork?: string;
        /** 描述 */
        description?: string;
        /** 作品总数 */
        worksNum?: number;
        /** 播放次数 */
        playCount?: number;
        /** 歌单创建日期 */
        createAt?: number;
        // 歌单作者
        artist?: string;
        // 原始数据
        _raw: string;
        // 排序信息
        _sortIndex: number;
    }


    export interface IMusicItemModel {
        platform: string;
        id: string;
        /** 作者 */
        artist: string;
        /** 歌曲标题 */
        title: string;
        /** 时长(s) */
        duration?: number;
        /** 专辑名 */
        album?: string;
        /** 专辑封面图 */
        artwork?: string;
        // 完整信息
        _raw: string;
        // 在歌单内的顺序
        _sortOrder: number;
        // 歌单ID
        _musicSheetId: string;
        // 歌单
        _musicSheetPlatform: string;
    }
}