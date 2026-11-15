/** 窗口尺寸（CSS 像素） */
export interface IEffectSize {
    width: number;
    height: number;
}

/**
 * 一个可视化效果。
 *
 * 所有效果共用同一份 `IVisualization.IAudioFrame` 与同一套引擎，
 * 不得各自取数——新增第 9 个效果只能改一个效果文件 + 注册表一行。
 */
export interface IVisualizationEffect {
    /** 效果 id，如 "bars" */
    id: string;
    /** i18n key，用于设置页显示名称 */
    nameKey: string;
    /** 初始化（画布尺寸变化时也可能被再次调用） */
    init?(ctx: CanvasRenderingContext2D, size: IEffectSize): void;
    /** 画一帧 */
    render(
        ctx: CanvasRenderingContext2D,
        size: IEffectSize,
        frame: IVisualization.IAudioFrame,
        colors: IVisualization.IThemeColors,
    ): void;
    /** 切换效果时清理内部状态 */
    reset?(): void;
}
