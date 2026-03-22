/**
 * 弹窗运行时注册
 *
 * 将 registry.ts 中定义的弹窗注册到 modalManager 的运行时映射。
 * 由 App.tsx import 此文件触发执行。
 *
 * 添加新弹窗时只需编辑 registry.ts，无需修改此文件。
 */
import { registerModals } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import { modalRegistry } from './registry';

registerModals(modalRegistry);
