/**
 * WindowDrag — 窗口全局拖拽
 *
 * 使辅助窗口（歌词、迷你模式）整个可拖拽，同时保留正常的事件处理。
 */

/** 注册窗口拖拽时的选项 */
export interface IWindowDragOptions {
    /** 窗口初始宽度 */
    width: number;
    /** 窗口初始高度 */
    height: number;
    /** 动态获取当前窗口尺寸（可选，尺寸会变化时使用） */
    getWindowSize?: () => ISize;
    /** 拖拽结束时回调，返回最终位置（未超过阈值时为 null） */
    onDragEnd?: (position: IPoint | null) => void;
}

export interface IPoint {
    x: number;
    y: number;
}

export interface ISize {
    width: number;
    height: number;
}
