/**
 * 可视化的共享常量。
 *
 * 主窗口（读主题色）与可视化窗口（拿不到主题色时的兜底）都要用，
 * 放在 common 下避免两个 bundle 互相依赖。
 */

/** 读不到主题色时的兜底配色（与 WMP Metal 主题一致） */
export const defaultVisualizationThemeColors: IVisualization.IThemeColors = {
    primary: "#f0a020",
    text: "#ffffff",
    background: "#232c36",
};
