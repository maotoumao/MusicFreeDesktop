/** IPC 通道 */
export const IPC = {
    START_DRAG: '@infra/window-drag/start-drag',
    STOP_DRAG: '@infra/window-drag/stop-drag',
} as const;

/** 拖拽阈值（像素），小于此值视为点击而非拖拽 */
export const DRAG_THRESHOLD = 5;

/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/window-drag';
