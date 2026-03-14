import { useAtomValue } from 'jotai/react';
import {
    contextMenuAtom,
    getContextMenuTemplate,
    closeContextMenu,
} from './contextMenuManager';
import { ContextMenu } from './index';

/**
 * ContextMenuContainer — 命令式右键菜单渲染器
 *
 * 从 jotai atom 读取当前右键菜单状态，查找注册的模板函数，
 * 调用模板函数生成 items，渲染 ContextMenu UI 组件。
 *
 * 使用方式：在 App.tsx 顶层挂载一次即可。
 */
export function ContextMenuContainer() {
    const state = useAtomValue(contextMenuAtom);

    if (!state) return null;

    const template = getContextMenuTemplate(state.name);

    if (!template) {
        if (__DEV__) {
            console.warn(
                `[ContextMenuContainer] 未注册的右键菜单模板: "${state.name}"。` +
                    `请在 business/contextMenus/registry.ts 中注册。`,
            );
        }
        return null;
    }

    const items = template(state.context);

    return (
        <ContextMenu
            visible
            position={state.position}
            items={items}
            onClose={closeContextMenu}
        />
    );
}
