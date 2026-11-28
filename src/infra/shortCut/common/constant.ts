/** IPC 通道 */
export const IPC = {
    GET_STATUS: '@infra/short-cut/get-global-status',
    STATUS_CHANGED: '@infra/short-cut/global-status-changed',
} as const;

/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/short-cut';
