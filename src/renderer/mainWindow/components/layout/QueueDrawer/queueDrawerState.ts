// ============================================================================
// QueueDrawer — 状态管理
// ============================================================================
//
// 与 Modal/Toast/ContextMenu 同构的 jotai atom + 命令式 API 模式：
//   atom 定义状态 → getDefaultStore().set() → 导出命令式函数 → 组件 useAtomValue 订阅
//

import { atom, getDefaultStore } from 'jotai';

// ────────────────────────────────────────────────────────────────────────────
// Atom
// ────────────────────────────────────────────────────────────────────────────

export const queueDrawerOpenAtom = atom(false);

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

const store = getDefaultStore();

/** 切换播放队列抽屉的开关状态 */
export function toggleQueueDrawer(): void {
    store.set(queueDrawerOpenAtom, (prev) => !prev);
}

/** 关闭播放队列抽屉 */
export function closeQueueDrawer(): void {
    store.set(queueDrawerOpenAtom, false);
}

/** 打开播放队列抽屉 */
export function openQueueDrawer(): void {
    store.set(queueDrawerOpenAtom, true);
}
