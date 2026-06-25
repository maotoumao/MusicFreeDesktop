/** IPC 通道 */
export const IPC = {
    GET_PORT: '@infra/request-forwarder/get-port',
    PORT_CHANGED: '@infra/request-forwarder/port-changed',
} as const;

/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/request-forwarder';
