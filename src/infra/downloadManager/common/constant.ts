/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/download-manager';

/** IPC 通道 */
export const IPC = {
    // ─── handle ───
    ADD_TASK: '@infra/download-manager/add-task',
    ADD_TASKS_BATCH: '@infra/download-manager/add-tasks-batch',
    PAUSE_TASK: '@infra/download-manager/pause-task',
    RESUME_TASK: '@infra/download-manager/resume-task',
    REMOVE_TASK: '@infra/download-manager/remove-task',
    REMOVE_DOWNLOAD: '@infra/download-manager/remove-download',
    RETRY_TASK: '@infra/download-manager/retry-task',
    PAUSE_ALL: '@infra/download-manager/pause-all',
    RESUME_ALL: '@infra/download-manager/resume-all',
    GET_TASKS: '@infra/download-manager/get-tasks',
    GET_ALL_TASKS: '@infra/download-manager/get-all-tasks',
    GET_ALL_DOWNLOADED: '@infra/download-manager/get-all-downloaded',

    // ─── broadcast ───
    PROGRESS: '@infra/download-manager/progress',
    TASK_EVENT: '@infra/download-manager/task-event',
} as const;
