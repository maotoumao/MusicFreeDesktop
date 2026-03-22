/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/local-music';

/** metadata 解析批大小 */
export const SCAN_BATCH_SIZE = 100;

/** IPC 通道 */
export const IPC = {
    // ─── 扫描文件夹管理 ───
    GET_SCAN_FOLDERS: '@infra/local-music/get-scan-folders',
    SYNC_SCAN_FOLDERS: '@infra/local-music/sync-scan-folders',

    // ─── 获取全量歌曲列表 ───
    GET_ALL_MUSIC_ITEMS: '@infra/local-music/get-all-music-items',

    // ─── 删除 ───
    DELETE_ITEMS: '@infra/local-music/delete-items',

    // ─── 广播 ───
    SCAN_PROGRESS: '@infra/local-music/scan-progress',
    LIBRARY_CHANGED: '@infra/local-music/library-changed',
} as const;
