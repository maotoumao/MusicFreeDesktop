/**
 * Motion Token 常量
 *
 * 与 global.scss 中的动效变量保持同源。
 * 用于 Framer Motion 的 transition 配置。
 *
 * CSS transition 使用 global.scss 中的 CSS 变量（--duration-*, --ease-*），
 * 此文件仅服务 Framer Motion 的 JS 侧动画。
 */

/** 时长（秒），对应 global.scss --duration-* */
export const duration = {
    instant: 0.08,
    fast: 0.12,
    normal: 0.2,
    moderate: 0.3,
    slow: 0.5,
    glacial: 0.7,
} as const;

/** 缓动曲线（Bezier 四元组），对应 global.scss --ease-* */
export const easing = {
    standard: [0.4, 0, 0.2, 1] as const,
    decelerate: [0.0, 0, 0.2, 1] as const,
    accelerate: [0.4, 0, 1, 1] as const,
    spring: [0.175, 0.885, 0.32, 1.275] as const,
    popup: [0.16, 1, 0.3, 1] as const,
} as const;

/** 预置 transition 配置，可直接用于 Framer Motion 的 transition prop */
export const transition = {
    /** 微交互：按钮 active scale */
    instant: { duration: duration.instant, ease: easing.standard },
    /** 快速过渡：hover 态 */
    fast: { duration: duration.fast, ease: easing.standard },
    /** 标准过渡：焦点态、颜色过渡 */
    normal: { duration: duration.normal, ease: easing.standard },
    /** 中等过渡：抽屉滑入、卡片 hover、页面入场 */
    moderate: { duration: duration.moderate, ease: easing.standard },
    /** 慢速过渡：全屏播放器入场 */
    slow: { duration: duration.slow, ease: easing.decelerate },
    /** 弹性入场 */
    spring: { duration: duration.moderate, ease: easing.spring },
    /** 弹出入场：下拉菜单、右键菜单 */
    popup: { duration: duration.fast, ease: easing.popup },
} as const;
