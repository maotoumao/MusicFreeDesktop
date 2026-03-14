/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/media-meta';

/** IPC 通道 */
export const IPC = {
    // ─── handle ───
    GET_META: '@infra/media-meta/get',
    BATCH_GET_META: '@infra/media-meta/batch-get',
    SET_META: '@infra/media-meta/set',
    DELETE_META: '@infra/media-meta/delete',
    QUERY_BY_FIELD: '@infra/media-meta/query-by-field',

    // ─── broadcast ───
    META_CHANGED: '@infra/media-meta/changed',
} as const;
