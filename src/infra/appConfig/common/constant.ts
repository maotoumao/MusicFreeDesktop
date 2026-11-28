/** IPC 通道 */
export const IPC = {
    SYNC_APP_CONFIG: '@infra/app-config/sync-app-config',
    SET_APP_CONFIG: '@infra/app-config/set-app-config',
    RESET: '@infra/app-config/reset',
    UPDATE_APP_CONFIG: '@infra/app-config/update-app-config',
} as const;

/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/app-config';
