import { useAtomValue } from 'jotai/react';
import { useCallback } from 'react';
import { modalStackAtom, getModalComponent, closeModal } from './modalManager';

/**
 * ModalContainer — 弹窗栈渲染器
 *
 * 只渲染栈顶弹窗。关闭栈顶后自动展示下一个。
 * 自动注入 `close` prop。
 *
 * 使用方式：在 App.tsx 顶层挂载一次即可。
 */
export function ModalContainer() {
    const stack = useAtomValue(modalStackAtom);

    const top = stack[stack.length - 1];
    if (!top) return null;

    return <ModalRenderer key={top.name} name={top.name} props={top.props} />;
}

// ── 单个弹窗渲染 ────────────────────────────────────────────

function ModalRenderer({
    name,
    props,
}: {
    name: string;
    props: Record<string, any>;
}) {
    const Component = getModalComponent(name);

    const close = useCallback(() => {
        closeModal(name);
    }, [name]);

    if (!Component) {
        if (__DEV__) {
            console.warn(
                `[ModalContainer] 未注册的弹窗: "${name}"。请在 business/modals/index.ts 中注册。`,
            );
        }
        return null;
    }

    return <Component {...props} close={close} />;
}
