/** localStorage 缓存 key */
export const THEMEPACK_STORAGE_KEY = 'themepack-cache';

/** 注入到 <head> 的 <style> 节点 ID */
export const THEMEPACK_STYLE_NODE_ID = 'themepack-style';

/** BlurHash 占位层的 DOM 节点 ID */
export const THEMEPACK_BLURHASH_NODE_ID = 'themepack-blurhash';

/** 背景 iframe 的 DOM 节点 ID */
export const THEMEPACK_IFRAME_NODE_ID = 'themepack-iframe';

/** 主题包安装目录名（位于 userData 下） */
export const THEMEPACK_DIR_NAME = 'musicfree-themepacks';

/** 内置主题包目录名（位于 res 下） */
export const BUILTIN_THEME_DIR_NAME = 'builtin-themes';

/** IPC 通道 */
export const IPC = {
    THEME_SWITCHED: '@infra/themepack/theme-switched',
} as const;

/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/themepack';
