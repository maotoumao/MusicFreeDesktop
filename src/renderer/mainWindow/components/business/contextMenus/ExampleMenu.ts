import type { ContextMenuEntry } from '../../ui/ContextMenu';

interface ExampleMenuContext {
    /** 条目名称（可选，用于展示） */
    itemName?: string;
}

/**
 * ExampleMenu — 示例右键菜单模板
 *
 * 演示如何定义一个带上下文参数的菜单模板函数。
 * 通过 showContextMenu("ExampleMenu", position, { itemName }) 触发。
 */
export function ExampleMenu(ctx: ExampleMenuContext): ContextMenuEntry[] {
    const label = ctx.itemName ?? '未知曲目';

    return [
        {
            id: 'play',
            label: `播放「${label}」`,
            onClick: () => {
                console.log('[ExampleMenu] 播放:', label);
            },
        },
        {
            id: 'add-to-sheet',
            label: '添加到歌单',
            onClick: () => {
                console.log('[ExampleMenu] 添加到歌单:', label);
            },
        },
        { type: 'separator' },
        {
            id: 'copy-link',
            label: '复制链接',
            onClick: () => {
                console.log('[ExampleMenu] 复制链接');
            },
        },
        {
            id: 'delete',
            label: '删除',
            danger: true,
            onClick: () => {
                console.log('[ExampleMenu] 删除:', label);
            },
        },
    ];
}
