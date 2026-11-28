/**
 * 右键菜单运行时注册
 *
 * 将 registry.ts 中定义的模板函数注册到 contextMenuManager 的运行时映射。
 * 由 App.tsx import 此文件触发执行。
 *
 * 添加新菜单模板时只需编辑 registry.ts，无需修改此文件。
 */
import { registerContextMenus } from '@renderer/mainWindow/components/ui/ContextMenu/contextMenuManager';
import { contextMenuRegistry } from './registry';

registerContextMenus(contextMenuRegistry);
