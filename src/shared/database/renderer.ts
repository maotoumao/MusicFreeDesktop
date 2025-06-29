/**
 * 数据库渲染器接口模块
 * 
 * 此模块提供对数据库操作的类型定义和接口声明，
 * 用于在渲染进程中访问主进程暴露的数据库功能。
 */

/**
 * 本地歌单数据库操作接口
 * 提供对 LocalMusicSheets 表的完整操作功能
 */
interface ILocalMusicSheetDB {
    ////////////////////////////////////////////////////////////////////////////////////
    //                                    基础增删改查方法
    ////////////////////////////////////////////////////////////////////////////////////

    /**
     * 添加歌单
     * @param musicSheet 歌单数据
     * @returns 是否添加成功
     */
    addMusicSheet: (musicSheet: Omit<IDataBaseModel.IMusicSheetModel, "_sortIndex">) => boolean;    
    
    /**
     * 批量添加歌单
     * @param musicSheets 歌单数据数组
     * @returns 成功添加的数量
     */
    batchAddMusicSheets: (musicSheets: IDataBaseModel.IMusicSheetModel[]) => number;
    
    /**
     * 删除歌单
     * @param platform 平台
     * @param id 歌单ID
     * @returns 是否删除成功
     */
    deleteMusicSheet: (platform: string, id: string) => boolean;
    
    /**
     * 批量删除歌单
     * @param sheets 要删除的歌单标识数组 {platform, id}
     * @returns 成功删除的数量
     */
    batchDeleteMusicSheets: (sheets: Array<{ platform: string; id: string }>) => number;
    
    /**
     * 查询单个歌单
     * @param platform 平台
     * @param id 歌单ID
     * @returns 歌单数据或null
     */
    getMusicSheet: (platform: string, id: string) => IDataBaseModel.IMusicSheetModel | null;
    
    /**
     * 查询所有歌单
     * @param orderBy 排序字段，默认按_sortIndex排序
     * @param order 排序方向，'ASC' 或 'DESC'，默认ASC
     * @returns 歌单数组
     */
    getAllMusicSheets: (orderBy?: string, order?: "ASC" | "DESC") => IDataBaseModel.IMusicSheetModel[];
    
    /**
     * 按平台查询歌单
     * @param platform 平台名称
     * @param orderBy 排序字段
     * @param order 排序方向
     * @returns 歌单数组
     */
    getMusicSheetsByPlatform: (platform: string, orderBy?: string, order?: "ASC" | "DESC") => IDataBaseModel.IMusicSheetModel[];
    
    /**
     * 更新歌单（部分更新）
     * @param platform 平台
     * @param id 歌单ID
     * @param updates 要更新的字段
     * @returns 是否更新成功
     */
    updateMusicSheet: (
        platform: string,
        id: string,
        updates: Partial<Omit<IDataBaseModel.IMusicSheetModel, "platform" | "id">>
    ) => boolean;


    /**
     * 清空歌单内所有歌曲
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @returns 清空的歌曲数量
     */
    clearAllMusicItemsInSheet: (
        musicSheetPlatform: string,
        musicSheetId: string,
    ) => number 

    ////////////////////////////////////////////////////////////////////////////////////
    //                                    排序和移动相关方法
    ////////////////////////////////////////////////////////////////////////////////////
    
    /**
     * 批量移动歌单到指定位置（使用浮点数分数法排序）
     * @param selectedSheets 要移动的歌单标识数组
     * @param targetPlatform 目标歌单的平台（null表示移动到开头/末尾）
     * @param targetId 目标歌单的ID（null表示移动到开头/末尾）
     * @param position 相对于目标歌单的位置："before" | "after"，默认"after"
     * @returns 成功移动的数量
     */
    batchMoveMusicSheets: (
        selectedSheets: Array<{ platform: string; id: string }>,
        targetPlatform?: string | null,
        targetId?: string | null,
        position?: "before" | "after"
    ) => number;

    ////////////////////////////////////////////////////////////////////////////////////
    //                                    歌曲数据库操作方法
    ////////////////////////////////////////////////////////////////////////////////////

    /**
     * 向歌单添加单首歌曲
     * @param musicItem 歌曲数据
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @param sortIndex 可选的排序索引，不提供则自动计算为最后位置
     * @returns 是否添加成功
     */
    addMusicItemToSheet: (
        musicItem: IDataBaseModel.IMusicItemModel,
        musicSheetPlatform: string,
        musicSheetId: string,
        sortIndex?: number
    ) => boolean;
    
    /**
     * 批量向歌单添加歌曲
     * @param musicItems 歌曲数据数组
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @returns 成功添加的数量
     */
    batchAddMusicItemsToSheet: (
        musicItems: IDataBaseModel.IMusicItemModel[],
        musicSheetPlatform: string,
        musicSheetId: string
    ) => number;
    
    /**
     * 从歌单中删除单首歌曲
     * @param musicItemPlatform 歌曲平台
     * @param musicItemId 歌曲ID
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @returns 是否删除成功
     */
    deleteMusicItemFromSheet: (
        musicItemPlatform: string,
        musicItemId: string,
        musicSheetPlatform: string,
        musicSheetId: string
    ) => boolean;
    
    /**
     * 批量从歌单中删除歌曲
     * @param musicItems 要删除的歌曲标识数组 {platform, id}
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @returns 成功删除的数量
     */
    batchDeleteMusicItemsFromSheet: (
        musicItems: Array<{ platform: string; id: string }>,
        musicSheetPlatform: string,
        musicSheetId: string
    ) => number;
    
    /**
     * 查询歌单中的单首歌曲
     * @param musicItemPlatform 歌曲平台
     * @param musicItemId 歌曲ID
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @returns 歌曲数据或null
     */    getMusicItemInSheet: (
        musicItemPlatform: string,
        musicItemId: string,
        musicSheetPlatform: string,
        musicSheetId: string
    ) => IDataBaseModel.IMusicItemModel | null;
    
    /**
     * 分页查询歌单中的歌曲
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @param options 查询选项
     * @returns 歌曲数组和总数
     */
    getMusicItemsInSheetPaginated: (
        musicSheetPlatform: string,
        musicSheetId: string,
        options?: {
            page?: number; // 页码，从1开始
            pageSize?: number; // 每页大小，默认50
            orderBy?: string; // 排序字段，默认_sortIndex
            order?: "ASC" | "DESC"; // 排序方向，默认ASC
        }
    ) => { items: IDataBaseModel.IMusicItemModel[]; total: number };
    
    /**
     * 更新歌单中歌曲的属性（部分更新）
     * @param musicItemPlatform 歌曲平台
     * @param musicItemId 歌曲ID
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @param updates 要更新的字段
     * @returns 是否更新成功
     */
    updateMusicItemInSheet: (
        musicItemPlatform: string,
        musicItemId: string,
        musicSheetPlatform: string,
        musicSheetId: string,
        updates: Partial<Omit<IDataBaseModel.IMusicItemModel, "platform" | "id" | "_musicSheetPlatform" | "_musicSheetId">>
    ) => boolean;
    
    /**
     * 搜索歌单中的歌曲
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @param keyword 搜索关键词
     * @param searchFields 搜索字段数组，默认搜索title和artist
     * @returns 匹配的歌曲数组
     */
    searchMusicItemsInSheet: (
        musicSheetPlatform: string,
        musicSheetId: string,
        keyword: string,
        searchFields?: string[]
    ) => IDataBaseModel.IMusicItemModel[];

    ////////////////////////////////////////////////////////////////////////////////////
    //                                    歌曲排序和移动相关方法
    ////////////////////////////////////////////////////////////////////////////////////

    /**
     * 批量移动歌单内歌曲到指定位置（使用浮点数分数法排序）
     * @param selectedItems 要移动的歌曲标识数组
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @param targetItemPlatform 目标歌曲的平台（null表示移动到开头/末尾）
     * @param targetItemId 目标歌曲的ID（null表示移动到开头/末尾）
     * @param position 相对于目标歌曲的位置："before" | "after"，默认"after"
     * @returns 成功移动的数量
     */
    batchMoveMusicItemsInSheet: (
        selectedItems: Array<{ platform: string; id: string }>,
        musicSheetPlatform: string,
        musicSheetId: string,
        targetItemPlatform?: string | null,
        targetItemId?: string | null,
        position?: "before" | "after"
    ) => number;
    
    /**
     * 检查歌曲是否在指定歌单中
     * @param musicItemPlatform 歌曲平台
     * @param musicItemId 歌曲ID
     * @param musicSheetPlatform 歌单平台
     * @param musicSheetId 歌单ID
     * @returns 是否存在
     */
    existsMusicItemInSheet: (
        musicItemPlatform: string,
        musicItemId: string,
        musicSheetPlatform: string,
        musicSheetId: string
    ) => boolean;

    ////////////////////////////////////////////////////////////////////////////////////
    //                                    查询和搜索相关方法
    ////////////////////////////////////////////////////////////////////////////////////

    /**
     * 搜索歌单
     * @param keyword 搜索关键词
     * @param searchFields 搜索字段数组，默认搜索title和artist
     * @returns 匹配的歌单数组
     */
    searchMusicSheets: (keyword: string, searchFields?: string[]) => IDataBaseModel.IMusicSheetModel[];
    
    /**
     * 获取歌单中的所有歌曲
     * @param platform 歌单平台
     * @param id 歌单ID
     * @param orderBy 排序字段，默认按_sortIndex排序
     * @param order 排序方向
     * @returns 歌曲数组
     */
    getMusicItemsInSheet: (
        platform: string,
        id: string,
        orderBy?: string,
        order?: "ASC" | "DESC"
    ) => IDataBaseModel.IMusicItemModel[];
    
    /**
     * 获取歌单中歌曲的数量
     * @param platform 歌单平台
     * @param id 歌单ID
     * @returns 歌曲数量
     */
    getMusicItemCountInSheet: (platform: string, id: string) => number;
    
    /**
     * 检查歌单是否存在
     * @param platform 平台
     * @param id 歌单ID
     * @returns 是否存在
     */
    existsMusicSheet: (platform: string, id: string) => boolean;
}

/**
 * 收藏歌单数据库操作接口
 * 提供对 StarredMusicSheets 表的完整操作功能
 */
interface IStarredMusicSheetDB {
    ////////////////////////////////////////////////////////////////////////////////////
    //                                    基础增删改查方法
    ////////////////////////////////////////////////////////////////////////////////////

    /**
     * 添加收藏歌单
     * @param musicSheet 歌单数据
     * @returns 是否添加成功
     */
    addStarredMusicSheet: (musicSheet: IDataBaseModel.IMusicSheetModel) => boolean;
    
    /**
     * 批量添加收藏歌单
     * @param musicSheets 歌单数据数组
     * @returns 成功添加的数量
     */
    batchAddStarredMusicSheets: (musicSheets: IDataBaseModel.IMusicSheetModel[]) => number;
    
    /**
     * 删除收藏歌单
     * @param platform 平台
     * @param id 歌单ID
     * @returns 是否删除成功
     */
    deleteStarredMusicSheet: (platform: string, id: string) => boolean;
    
    /**
     * 批量删除收藏歌单
     * @param sheets 要删除的歌单标识数组 {platform, id}
     * @returns 成功删除的数量
     */
    batchDeleteStarredMusicSheets: (sheets: Array<{ platform: string; id: string }>) => number;
    
    /**
     * 查询单个收藏歌单
     * @param platform 平台
     * @param id 歌单ID
     * @returns 歌单数据或null
     */
    getStarredMusicSheet: (platform: string, id: string) => IDataBaseModel.IMusicSheetModel | null;
    
    /**
     * 查询所有收藏歌单
     * @param orderBy 排序字段，默认按_sortIndex排序
     * @param order 排序方向，'ASC' 或 'DESC'，默认ASC
     * @returns 歌单数组
     */
    getAllStarredMusicSheets: (orderBy?: string, order?: "ASC" | "DESC") => IDataBaseModel.IMusicSheetModel[];
    
    /**
     * 按平台查询收藏歌单
     * @param platform 平台名称
     * @param orderBy 排序字段
     * @param order 排序方向
     * @returns 歌单数组
     */
    getStarredMusicSheetsByPlatform: (platform: string, orderBy?: string, order?: "ASC" | "DESC") => IDataBaseModel.IMusicSheetModel[];
    
    /**
     * 更新收藏歌单（部分更新）
     * @param platform 平台
     * @param id 歌单ID
     * @param updates 要更新的字段
     * @returns 是否更新成功
     */
    updateStarredMusicSheet: (
        platform: string,
        id: string,
        updates: Partial<Omit<IDataBaseModel.IMusicSheetModel, "platform" | "id">>
    ) => boolean;

    ////////////////////////////////////////////////////////////////////////////////////
    //                                    排序和移动相关方法
    ////////////////////////////////////////////////////////////////////////////////////

    /**
     * 批量移动收藏歌单到指定位置（使用浮点数分数法排序）
     * @param selectedSheets 要移动的歌单标识数组
     * @param targetPlatform 目标歌单的平台（null表示移动到开头/末尾）
     * @param targetId 目标歌单的ID（null表示移动到开头/末尾）
     * @param position 相对于目标歌单的位置："before" | "after"，默认"after"
     * @returns 成功移动的数量
     */
    batchMoveStarredMusicSheets: (
        selectedSheets: Array<{ platform: string; id: string }>,
        targetPlatform?: string | null,
        targetId?: string | null,
        position?: "before" | "after"
    ) => number;

    ////////////////////////////////////////////////////////////////////////////////////
    //                                    查询和搜索相关方法
    ////////////////////////////////////////////////////////////////////////////////////

    /**
     * 搜索收藏歌单
     * @param keyword 搜索关键词
     * @param searchFields 搜索字段数组，默认搜索title和artist
     * @returns 匹配的歌单数组
     */
    searchStarredMusicSheets: (keyword: string, searchFields?: string[]) => IDataBaseModel.IMusicSheetModel[];
    
    /**
     * 获取收藏歌单的数量
     * @returns 歌单数量
     */
    getStarredMusicSheetCount: () => number;
    
    /**
     * 检查歌单是否已收藏
     * @param platform 平台
     * @param id 歌单ID
     * @returns 是否已收藏
     */
    isStarredMusicSheet: (platform: string, id: string) => boolean;
    
    /**
     * 分页查询收藏歌单
     * @param options 查询选项
     * @returns 歌单数组和总数
     */
    getStarredMusicSheetsPaginated: (options?: {
        page?: number; // 页码，从1开始
        pageSize?: number; // 每页大小，默认20
        orderBy?: string; // 排序字段，默认_sortIndex
        order?: "ASC" | "DESC"; // 排序方向，默认ASC
        platform?: string; // 可选的平台过滤
    }) => { items: IDataBaseModel.IMusicSheetModel[]; total: number };
}

/**
 * 数据库模块接口
 * 包含本地歌单和收藏歌单的所有操作接口
 */
interface IMod {
    LocalMusicSheetDB: ILocalMusicSheetDB;
    StarredMusicSheetDB: IStarredMusicSheetDB;
}

const database = window["@shared/database" as any] as unknown as IMod;

export default database;