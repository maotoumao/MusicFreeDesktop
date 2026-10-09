/**
 * 应用支持的窗口类型。
 * - `main`: 主窗口
 * - `lyric`: 歌词窗口
 * - `minimode`: 迷你模式窗口
 */
export type WindowType = 'main' | 'lyric' | 'minimode';

/**
 * 窗口管理器可订阅的事件及其载荷类型。
 */
export interface IWindowEvents {
    /**
     * 窗口创建完成后触发。
     */
    create: { windowType: WindowType };
    /**
     * 窗口关闭后触发。
     */
    close: { windowType: WindowType };
}

/**
 * 窗口管理器接口，负责创建、显示、隐藏、通信与事件订阅。
 */
export interface IWindowManager {
    /**
     * 关闭指定类型的窗口。
     */
    closeWindow: (windowName: WindowType) => void;

    /**
     * 关闭所有已管理的窗口。
     */
    closeAllWindows: () => void;

    /**
     * 显示指定窗口。
     */
    showWindow: (windowName: WindowType) => void;

    /**
     * 隐藏指定窗口。
     */
    hideWindow: (windowName: WindowType) => void;

    /**
     * 切换指定窗口的显示状态（显示/隐藏）。
     */
    toggleWindow: (windowName: WindowType) => void;

    /**
     * 聚焦指定窗口。
     */
    focusWindow: (windowName: WindowType) => void;

    /**
     * 进入迷你模式（创建 minimode 窗口并隐藏主窗口）。
     */
    enterMinimode: () => void;

    /**
     * 退出迷你模式（关闭 minimode 窗口并恢复主窗口）。
     */
    exitMinimode: () => void;

    /**
     * 查询当前是否处于迷你模式。
     */
    isMinimode: () => boolean;

    /**
     * 获取指定类型窗口的原始 BrowserWindow 实例。
     *
     * @internal 仅供 main/core 内部模块使用，不应在 infra 层调用。
     * 优先使用 IWindowManager 上的高层方法（sendTo / broadcast / on 等）。
     * 若窗口不存在或已销毁，返回 null。
     */
    __getWindowUnsafe: (windowName: WindowType) => BrowserWindow | null;

    /**
     * 判断指定窗口是否已存在（已创建且可被管理）。
     */
    isWindowExist: (windowName: WindowType) => boolean;

    /**
     * 判断指定窗口是否已销毁。
     */
    isWindowDestroyed: (windowName: WindowType) => boolean;

    /**
     * 判断指定窗口当前是否可见。
     */
    isWindowVisible: (windowName: WindowType) => boolean;

    /**
     * 向指定窗口发送 IPC 消息（基于 `webContents.send`）。
     *
     * @param type 目标窗口类型
     * @param channel IPC 通道名
     * @param args 透传参数
     */
    sendTo(type: WindowType, channel: string, ...args: unknown[]): void;

    /**
     * 向所有窗口广播 IPC 消息（基于 `webContents.send`）。
     *
     * @param channel IPC 通道名
     * @param args 透传参数
     */
    broadcast(channel: string, ...args: unknown[]): void;

    /**
     * 向指定窗口发送 `postMessage` 消息。
     *
     * @param type 目标窗口类型
     * @param channel 消息通道名
     * @param data 消息数据
     * @param ports 可选的消息端口数组
     */
    postMessageTo(
        type: WindowType,
        channel: string,
        data: unknown,
        ports?: MessagePortMain[],
    ): void;

    /**
     * 监听窗口管理器事件.
     *
     * @param event 事件名
     * @param listener 事件回调，参数类型与事件名严格对应
     */
    on<T extends keyof IWindowEvents>(event: T, listener: (data: IWindowEvents[T]) => void): void;
}
