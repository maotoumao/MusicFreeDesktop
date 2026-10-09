/** IPC 通道 */
export const IPC = {
    PORT: '@infra/app-sync/port',
    UNMOUNT: '@infra/app-sync/unmount',
    COMMAND: '@infra/app-sync/command',
    SYNC_STATE: '@infra/app-sync/sync-state',
} as const;

/** contextBridge key（主窗口） */
export const CONTEXT_BRIDGE_KEY = '@infra/app-sync';

/** contextBridge key（辅助窗口） */
export const CONTEXT_BRIDGE_KEY_AUXILIARY = '@infra/app-sync-auxiliary';
