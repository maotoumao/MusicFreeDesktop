/**
 * Plugin Manager 模块类型定义
 *
 * 管理插件的安装、卸载、加载、调用等全生命周期。
 */

/** 插件状态码 */
export const enum PluginStateCode {
    /** 未加载 */
    NotLoaded = 'not-loaded',
    /** 加载中 */
    Loading = 'loading',
    /** 已就绪 */
    Ready = 'ready',
    /** 加载失败 */
    Error = 'error',
}

/** 调用插件方法的参数 */
export interface ICallPluginMethodParams<
    T extends keyof IPlugin.IPluginInstanceMethods = keyof IPlugin.IPluginInstanceMethods,
> {
    /** 插件 hash（标识唯一插件实例）。hash 和 platform 二选一。 */
    hash?: string;
    /** 插件 platform 名称。hash 和 platform 二选一。 */
    platform?: string;
    /** 要调用的方法名 */
    method: T;
    /** 传递给方法的参数列表 */
    args: Parameters<IPlugin.IPluginInstanceMethods[T]>;
}

/** getMediaSource adapter 所需的参数 */
export interface IGetMediaSourceParams {
    /** 音乐项 */
    musicItem: IMusic.IMusicItem;
    /** 初始请求的音质 */
    quality: IMusic.IQualityKey;
    /** 音质偏好顺序（从高到低） */
    qualityOrder: IMusic.IQualityKey[];
    /** 回退策略：higher=向高音质回退, lower=向低音质回退 */
    qualityFallbackOrder: 'higher' | 'lower';
}

/** getMediaSource adapter 的返回值 */
export interface IGetMediaSourceResult extends IPlugin.IMediaSourceResult {
    /** 实际获取到的音质 */
    quality: IMusic.IQualityKey;
}

/** 插件缓存数据（供首帧渲染使用） */
export interface IPluginCacheData {
    /** 所有已安装插件的 delegate 列表 */
    plugins: IPlugin.IPluginDelegate[];
}

/** 插件元信息存储结构 */
export type IPluginMetaAll = Record<string, IPlugin.IPluginMeta>;
