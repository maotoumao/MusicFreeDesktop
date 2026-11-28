/** IPC 通道 */
export const IPC = {
    GET_INFO: '@infra/request-forwarder/get-info',
    INFO_CHANGED: '@infra/request-forwarder/info-changed',
} as const;

/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/request-forwarder';

/** 代理 URL 中携带访问令牌的查询参数名 */
export const TOKEN_PARAM = 'token';
