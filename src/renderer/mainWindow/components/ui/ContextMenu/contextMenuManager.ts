import { atom, getDefaultStore } from 'jotai';
import type { ContextMenuEntry, ContextMenuPosition } from './index';

// ────────────────────────────────────────────────────────────────────────────
// Type-safe Registry
//
// [Architecture Tradeoff] 与 modalManager.ts 同理：通过 `import type`
// 从 business/contextMenus 导入 registry 类型，使 ui 层对 business 层
// 产生类型级别的反向依赖。`import type` 不产生运行时依赖。
// ────────────────────────────────────────────────────────────────────────────
import type { contextMenuRegistry } from '@renderer/mainWindow/components/business/contextMenus/registry';

type ContextMenuRegistry = typeof contextMenuRegistry;
type MenuName = keyof ContextMenuRegistry;

/**
 * 模板函数的参数列表。
 * - 无参模板 → `[]`
 * - 有参模板 → `[ctx: SomeContext]`
 */
type MenuTemplateArgs<K extends MenuName> = Parameters<ContextMenuRegistry[K]>;

// ────────────────────────────────────────────────────────────────────────────
// Runtime Registry
// ────────────────────────────────────────────────────────────────────────────

type AnyMenuTemplate = (...args: any[]) => ContextMenuEntry[];

let runtimeRegistry: Record<string, AnyMenuTemplate> = {};

/**
 * 注册右键菜单模板函数集合（运行时）。
 * 由 business/contextMenus/index.ts 在 App 启动时调用。
 */
export function registerContextMenus(menus: Record<string, AnyMenuTemplate>): void {
    runtimeRegistry = { ...runtimeRegistry, ...menus };
}

/** 获取已注册的模板函数 */
export function getContextMenuTemplate(name: string): AnyMenuTemplate | undefined {
    return runtimeRegistry[name];
}

// ────────────────────────────────────────────────────────────────────────────
// Jotai State
// ────────────────────────────────────────────────────────────────────────────

export interface ContextMenuState {
    /** 模板名称 */
    name: string;
    /** 菜单弹出位置 */
    position: ContextMenuPosition;
    /** 传给模板函数的上下文参数 */
    context: any;
}

export const contextMenuAtom = atom(null as ContextMenuState | null);
const store = getDefaultStore();

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * 命令式打开一个已注册的右键菜单。
 *
 * - 名称和 context 均有完整类型提示
 * - 同一时刻只展示一个右键菜单（新调用会替换旧的）
 *
 * @example
 * ```ts
 * // 无上下文的菜单
 * showContextMenu("ExampleMenu", { x: e.clientX, y: e.clientY });
 *
 * // 带上下文的菜单
 * showContextMenu("SongMenu", { x, y }, { musicItem, isFavorite });
 * ```
 */
export function showContextMenu<K extends MenuName>(
    name: K,
    position: ContextMenuPosition,
    ...context: MenuTemplateArgs<K>
): void {
    const state: ContextMenuState = {
        name: name as string,
        position,
        context: context[0],
    };
    store.set(contextMenuAtom, state);
}

/**
 * 关闭当前右键菜单。
 */
export function closeContextMenu(): void {
    store.set(contextMenuAtom, null);
}
