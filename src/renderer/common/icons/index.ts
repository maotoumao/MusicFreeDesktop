// ============================================================================
// 自定义图标 — 基于 createLucideIcon 扩展
// ============================================================================
//
// 本文件存放项目中 Lucide 官方库未提供的自定义图标。
// 所有图标遵循 Lucide 图标规范：
//   - viewBox: 0 0 24 24
//   - stroke: currentColor, strokeWidth: 2
//   - strokeLinecap: round, strokeLinejoin: round
//   - 不使用 fill（或 fill="none"）
//
// 创建的图标类型为 LucideIcon，与官方图标完全兼容，可直接使用
// <IconName size={20} /> 等 props。
//
// 新增图标步骤：
//   1. 在下方用 createLucideIcon(displayName, iconNode) 定义
//   2. iconNode 格式: [tagName, svgAttributes][]
//   3. 导出即可使用

import { createLucideIcon } from 'lucide-react';

// ─── DesktopLyric ───────────────────────────────────────────────────────────
// 桌面歌词图标：一个显示器轮廓内嵌歌词文字行，表达"桌面歌词"概念。
// 设计思路：
//   - 外层为简洁的显示器边框（圆角矩形 + 底座）
//   - 内层为两条水平线条，象征歌词文字
//   - 整体在 16px 下仍可辨识
export const DesktopLyric = createLucideIcon('DesktopLyric', [
    // 显示器外框
    [
        'rect',
        {
            x: '2',
            y: '3',
            width: '20',
            height: '14',
            rx: '2',
            ry: '2',
        },
    ],
    // 显示器底座支架
    ['line', { x1: '12', y1: '17', x2: '12', y2: '21' }],
    // 底座横杆
    ['line', { x1: '8', y1: '21', x2: '16', y2: '21' }],
    // 歌词行 1（较长）
    ['line', { x1: '6', y1: '8', x2: '18', y2: '8' }],
    // 歌词行 2（较短，居中）
    ['line', { x1: '8', y1: '12', x2: '16', y2: '12' }],
]);
