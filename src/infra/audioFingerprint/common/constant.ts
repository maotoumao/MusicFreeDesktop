/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/audio-fingerprint';

/** fpcalc 二进制在 res/ 下的平台目录名 */
export const FPCALC_BIN_DIRS = {
    win32: 'win-x64',
    darwin: 'mac-arm64',
    linux: 'linux-x64',
} as const;

/** IPC 通道 */
export const IPC = {
    /** invoke: 检查 fpcalc 二进制是否存在且可执行 */
    CHECK_BINARY: '@infra/audio-fingerprint/check-binary',
    /** invoke: 计算单个文件的指纹（命中磁盘缓存则直接返回） */
    CALCULATE: '@infra/audio-fingerprint/calculate',
    /** invoke: 计算单个文件的 MD5（完全相同模式） */
    FILE_HASH: '@infra/audio-fingerprint/file-hash',
    /** invoke: 指纹缓存整体信息（路径/大小/条目数/标记大小） */
    CACHE_INFO: '@infra/audio-fingerprint/cache-info',
    /** invoke: 删除整个指纹缓存（含手动版本标记） */
    CLEAR_CACHE: '@infra/audio-fingerprint/clear-cache',
    /** invoke: 清理不在 keep 列表中的缓存条目，空列表拒绝执行 */
    PRUNE_CACHE: '@infra/audio-fingerprint/prune-cache',
    /** invoke: 读取手动版本标记 */
    MARKS_LOAD: '@infra/audio-fingerprint/version-marks-load',
    /** invoke: 写入手动版本标记 */
    MARKS_SAVE: '@infra/audio-fingerprint/version-marks-save',
} as const;
