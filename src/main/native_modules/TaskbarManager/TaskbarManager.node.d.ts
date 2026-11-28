/**
 * Windows 任务栏缩略图管理器
 *
 * 允许 Node.js / Electron 应用程序自定义 Windows 任务栏预览窗口、
 * 缩略图图像以及缩略图工具栏按钮。
 *
 * 典型使用流程：
 * 1. 调用 `createTaskbarGroup` 创建缩略图窗口
 * 2. 调用 `setThumbarButtons` 设置初始按钮
 * 3. 使用 `updateThumbarButton` 进行状态更新
 * 4. 使用 `sendIconicRepresentation` 设置预览图像
 *
 * @example
 * ```js
 * const ttm = require('./TaskbarThumbnailManager.node');
 *
 * // 获取 Electron BrowserWindow 的原生句柄
 * const hwnd = mainWindow.getNativeWindowHandle().readBigInt64LE();
 *
 * ttm.createTaskbarGroup(hwnd, 'path/to/icon.ico');
 * ttm.setThumbarButtons([
 *   { icon: 'prev.ico', tooltip: '上一首', click: () => player.prev() },
 *   { icon: 'play.ico', tooltip: '播放',   click: () => player.play() },
 *   { icon: 'next.ico', tooltip: '下一首', click: () => player.next() },
 * ]);
 * ttm.setWindowMessage('正在播放: 歌曲名称');
 * ```
 */
declare module '@main/native_modules/TaskbarManager/TaskbarManager.node' {
    /** 缩略图按钮配置 */
    interface ThumbarButtonConfig {
        /** 图标文件路径（.ico 格式） */
        icon: string;
        /** 鼠标悬停时的工具提示文本 */
        tooltip: string;
        /** 按钮点击回调函数 */
        click: () => void;
    }

    /** 更新单个按钮时的配置（click 为可选） */
    interface ThumbarButtonUpdateConfig {
        /** 新的图标文件路径（.ico 格式） */
        icon: string;
        /** 新的工具提示文本 */
        tooltip: string;
        /** 是否禁用按钮（可选，默认 false） */
        disabled?: boolean;
        /** 新的点击回调函数（可选，不传则保留原回调） */
        click?: () => void;
    }

    /** 图像尺寸描述 */
    interface ImageSize {
        /** 图像宽度（像素） */
        width: number;
        /** 图像高度（像素） */
        height: number;
    }

    /**
     * 创建任务栏分组窗口
     *
     * 创建一个隐藏的缩略图窗口，并注册到 Windows 任务栏以显示自定义预览。
     * 内部会调用 `ITaskbarList3::RegisterTab` 和 `DwmSetWindowAttribute` 配置
     * 图标化表示与实时预览支持。
     *
     * @param hwnd - 主窗口句柄（Electron 中通过 `BrowserWindow.getNativeWindowHandle().readBigInt64LE()` 获取）
     * @param iconPath - 窗口小图标文件路径（.ico 格式）
     * @returns 成功返回 `true`，失败抛出异常
     *
     * @example
     * ```js
     * const hwnd = mainWindow.getNativeWindowHandle().readBigInt64LE();
     * ttm.createTaskbarGroup(hwnd, 'assets/app.ico');
     * ```
     */
    export function createTaskbarGroup(hwnd: bigint, iconPath: string): boolean;

    /**
     * 设置任务栏缩略图预览图像
     *
     * 设置鼠标悬停在任务栏图标上时显示的缩略图。
     * 图像数据必须是 RGBA 格式，大小为 `width × height × 4` 字节。
     *
     * @param size - 图像尺寸，包含 `width` 和 `height`
     * @param buffer - RGBA 格式的图像像素数据
     * @returns HRESULT 值，`0` (S_OK) 表示成功
     *
     * @example
     * ```js
     * const pixels = Buffer.from(rgbaData);
     * ttm.sendIconicRepresentation({ width: 200, height: 150 }, pixels);
     * ```
     */
    export function sendIconicRepresentation(size: ImageSize, buffer: Buffer): number;

    /**
     * 设置任务栏缩略图按钮组
     *
     * 设置缩略图预览中显示的按钮组，最多支持 **7** 个按钮。
     * 调用此函数会清除之前所有按钮并重新创建。
     *
     * > **性能提示：** 频繁调用此函数开销较大，如需更新单个按钮状态，
     * > 请使用 `updateThumbarButton`。
     *
     * @param buttons - 按钮配置数组（最多 7 个）
     * @returns 成功返回 `true`，失败抛出异常或返回 `null`
     *
     * @example
     * ```js
     * ttm.setThumbarButtons([
     *   { icon: 'play.ico',  tooltip: '播放', click: () => player.play() },
     *   { icon: 'pause.ico', tooltip: '暂停', click: () => player.pause() },
     *   { icon: 'stop.ico',  tooltip: '停止', click: () => player.stop() },
     * ]);
     * ```
     */
    export function setThumbarButtons(buttons: ThumbarButtonConfig[]): boolean;

    /**
     * 设置缩略图窗口标题
     *
     * 同时更新缩略图窗口和主窗口的标题文本，支持 Unicode（包括中文、emoji 等）。
     * 内部使用 `SendMessageTimeoutW` + `SMTO_ABORTIFHUNG` 确保即时更新且不会阻塞主线程。
     *
     * @param title - 窗口标题文本
     * @returns 成功返回 `true`，失败抛出异常
     *
     * @example
     * ```js
     * ttm.setWindowMessage('正在播放: 歌曲名称 - 歌手');
     * ```
     */
    export function setWindowMessage(title: string): boolean;

    /**
     * 设置缩略图窗口关闭回调
     *
     * 当用户点击缩略图窗口的关闭按钮时，将调用此回调而非直接销毁窗口。
     * 由宿主（JS 层）决定是关闭应用、隐藏到托盘还是忽略。
     * 如未设置回调，关闭事件会转发给主窗口的 `WM_CLOSE`。
     *
     * @param handler - 关闭回调函数，传 `null` 或不传参数则清除回调
     *
     * @example
     * ```js
     * // 设置关闭回调
     * ttm.setCloseHandler(() => {
     *   app.quit();         // 关闭应用
     * });
     *
     * // 清除回调（恢复默认行为：转发 WM_CLOSE 给主窗口）
     * ttm.setCloseHandler(null);
     * ```
     */
    export function setCloseHandler(handler: (() => void) | null): void;
}
