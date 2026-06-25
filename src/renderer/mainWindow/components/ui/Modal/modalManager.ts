import { type ComponentType, type ComponentProps } from 'react';
import { atom, getDefaultStore } from 'jotai';

// ────────────────────────────────────────────────────────────────────────────
// Type-safe Registry
//
// [Architecture Tradeoff] 此处使用 `import type` 从 business/modals 导入
// modalRegistry 的类型，使得 ui/Modal 对 business 层产生类型级别的反向
// 依赖。这是为了让 showModal("名称", props) 获得完整的名称补全和
// props 类型提示所做的刻意权衡。`import type` 不会产生运行时
// 依赖，不影响打包和加载顺序。
// ────────────────────────────────────────────────────────────────────────────
import type { modalRegistry } from '@renderer/mainWindow/components/business/modals/registry';

type ModalRegistry = typeof modalRegistry;
type ModalName = keyof ModalRegistry;
type ModalComponentProps<K extends ModalName> = ComponentProps<ModalRegistry[K]>;

// ────────────────────────────────────────────────────────────────────────────
// Runtime Registry
// ────────────────────────────────────────────────────────────────────────────

type AnyModalComponent = ComponentType<any>;

let runtimeRegistry: Record<string, AnyModalComponent> = {};

/**
 * 注册弹窗组件集合（运行时）。
 * 由 business/modals/index.ts 在 App 启动时调用。
 */
export function registerModals(modals: Record<string, AnyModalComponent>): void {
    runtimeRegistry = { ...runtimeRegistry, ...modals };
}

/** 获取已注册的弹窗组件 */
export function getModalComponent(name: string): AnyModalComponent | undefined {
    return runtimeRegistry[name];
}

// ────────────────────────────────────────────────────────────────────────────
// Jotai State
// ────────────────────────────────────────────────────────────────────────────

export interface ModalStackItem {
    name: string;
    props: Record<string, any>;
}

export const modalStackAtom = atom<ModalStackItem[]>([]);
const store = getDefaultStore();

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * 打开一个已注册的弹窗。
 *
 * - 同名弹窗不会重复入栈（幂等）
 * - 名称和 props 均有完整类型提示
 *
 * @example
 * ```ts
 * showModal("ExampleModal", { title: "标题", content: "内容" });
 * ```
 */
export function showModal<K extends ModalName>(
    name: K,
    ...args: Record<string, never> extends Omit<ModalComponentProps<K>, 'close'>
        ? [props?: Omit<ModalComponentProps<K>, 'close'>]
        : [props: Omit<ModalComponentProps<K>, 'close'>]
): void {
    const current = store.get(modalStackAtom);

    // 幂等：同名不重复
    if (current.some((item) => item.name === name)) {
        return;
    }

    const props = args[0] ?? {};
    store.set(modalStackAtom, [
        ...current,
        { name: name as string, props: props as Record<string, unknown> },
    ]);
}

/**
 * 关闭指定弹窗（按名称）。若不传参，关闭栈顶弹窗。
 */
export function closeModal(name?: string): void {
    const current = store.get(modalStackAtom);
    if (current.length === 0) return;

    if (name) {
        store.set(
            modalStackAtom,
            current.filter((item) => item.name !== name),
        );
    } else {
        store.set(modalStackAtom, current.slice(0, -1));
    }
}

/**
 * 关闭所有弹窗。
 */
export function closeAllModals(): void {
    store.set(modalStackAtom, []);
}
