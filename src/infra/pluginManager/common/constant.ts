/**
 * pluginManager — 常量定义
 *
 * IPC 通道名、路径常量、音质键名等。
 */

// ─── IPC 通道 ───

/** 调用插件方法 */
export const IPC_CALL_PLUGIN_METHOD = '@infra/plugin-manager/call-method';

/** 安装插件（URL 或本地路径） */
export const IPC_INSTALL_PLUGIN = '@infra/plugin-manager/install';

/** 卸载插件 */
export const IPC_UNINSTALL_PLUGIN = '@infra/plugin-manager/uninstall';

/** 更新插件 */
export const IPC_UPDATE_PLUGIN = '@infra/plugin-manager/update';

/** 批量更新全部插件 */
export const IPC_UPDATE_ALL_PLUGINS = '@infra/plugin-manager/update-all';

/** 获取所有插件 delegate 列表 */
export const IPC_GET_ALL_PLUGINS = '@infra/plugin-manager/get-all';

/** 设置插件 meta 信息（排序、用户变量等） */
export const IPC_SET_PLUGIN_META = '@infra/plugin-manager/set-meta';

/** 获取所有插件 meta 信息 */
export const IPC_GET_ALL_PLUGIN_META = '@infra/plugin-manager/get-all-meta';

/** 批量设置插件 meta 信息（单次 IPC，单次落盘） */
export const IPC_BATCH_SET_PLUGIN_META = '@infra/plugin-manager/batch-set-meta';

/** 插件列表变更通知 */
export const IPC_PLUGIN_LIST_CHANGED = '@infra/plugin-manager/list-changed';

/** getLyric 适配器（主进程处理，含本地文件读取） */
export const IPC_GET_LYRIC = '@infra/plugin-manager/get-lyric';

/** getMediaSource 适配器（主进程处理，含音质回退和重试） */
export const IPC_GET_MEDIA_SOURCE = '@infra/plugin-manager/get-media-source';

// ─── 路径常量 ───

/** 插件 JS 文件存储目录名 */
export const PLUGIN_DIR_NAME = 'musicfree-plugins';

/** 插件持久化存储目录名 */
export const PLUGIN_STORAGE_DIR_NAME = 'musicfree-plugin-storage';

/** 插件持久化存储文件名 */
export const PLUGIN_STORAGE_FILE_NAME = 'chunk.json';

/** 插件缓存文件名（用于 preload 同步读取，首帧渲染） */
export const PLUGIN_CACHE_FILE_NAME = '.plugin-cache.json';

/** 插件 meta 文件名（排序、用户变量等） */
export const PLUGIN_META_FILE_NAME = '.plugin-meta.json';

// ─── 其他常量 ───

/** 插件存储文件大小上限（10MB） */
export const PLUGIN_STORAGE_MAX_SIZE = 10 * 1024 * 1024;

/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/plugin-manager';
