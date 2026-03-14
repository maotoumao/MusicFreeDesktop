/**
 * 右键菜单模板注册表
 *
 * 独立文件，不 import contextMenuManager，避免循环依赖。
 * contextMenuManager.ts 通过 `import type` 引用此对象推导类型。
 * contextMenus/index.ts 引用此对象执行运行时注册。
 *
 * 添加新菜单模板：
 *   1. 创建模板函数（接收上下文参数，返回 ContextMenuEntry[]）
 *   2. 在下方 import 并加入 contextMenuRegistry
 *
 * @example
 * ```ts
 * // 无上下文参数
 * function GlobalMenu(): ContextMenuEntry[] { ... }
 *
 * // 带上下文参数
 * function SongMenu(ctx: { musicItem: MusicItem }): ContextMenuEntry[] { ... }
 * ```
 */
import { ExampleMenu } from './ExampleMenu';
import { MusicItemMenu } from './MusicItemMenu';
import { StarredSheetMenu } from './StarredSheetMenu';
import { LocalSheetMenu } from './LocalSheetMenu';
import { LocalThemeMenu } from './LocalThemeMenu';
import { RemoteThemeMenu } from './RemoteThemeMenu';

export const contextMenuRegistry = {
    ExampleMenu,
    MusicItemMenu,
    StarredSheetMenu,
    LocalSheetMenu,
    LocalThemeMenu,
    RemoteThemeMenu,
} as const;
