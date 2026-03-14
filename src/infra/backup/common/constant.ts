/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/backup';

/** WebDAV 固定远端备份路径 */
export const WEBDAV_BACKUP_PATH = '/MusicFree/MusicFreeBackup.json';

/** IPC 通道 */
export const IPC = {
    /** invoke: 备份到指定本地文件路径 */
    BACKUP_TO_FILE: '@infra/backup/backup-to-file',
    /** invoke: 从指定本地文件路径恢复 */
    RESTORE_FROM_FILE: '@infra/backup/restore-from-file',
    /** invoke: 备份到 WebDAV */
    BACKUP_TO_WEBDAV: '@infra/backup/backup-to-webdav',
    /** invoke: 从 WebDAV 恢复 */
    RESTORE_FROM_WEBDAV: '@infra/backup/restore-from-webdav',
    /** invoke: 测试 WebDAV 连通性 */
    TEST_WEBDAV: '@infra/backup/test-webdav',
    /** broadcast: 进度事件 */
    PROGRESS: '@infra/backup/progress',
} as const;
