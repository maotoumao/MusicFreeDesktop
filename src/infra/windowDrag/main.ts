/**
 * windowDrag — 主进程层
 *
 * 职责:
 *  1. Win32: 通过 hookWindowMessage 拦截原生鼠标消息实现拖拽
 *  2. macOS/Linux: 通过 IPC 接收拖拽起始偏移，轮询光标位置移动窗口
 *  3. 管理已注册窗口的生命周期，窗口关闭时自动清理
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import type { IWindowDragOptions, IPoint } from '@appTypes/infra/windowDrag';
import { IPC, DRAG_THRESHOLD } from './common/constant';

// ─── Win32 原生消息常量 ───

/** https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousemove */
const WM_MOUSEMOVE = 0x0200;
/** https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-lbuttonup */
const WM_LBUTTONUP = 0x0202;
/** 左键按下状态位 */
const MK_LBUTTON = 0x0001;

// ─── Win32 拖拽实现 ───

/**
 * Win32 平台：通过拦截原生窗口消息实现全窗口拖拽。
 *
 * 直接在 main 进程处理 WM_MOUSEMOVE/WM_LBUTTONUP，
 * 延迟足够位移后才开始移动窗口，小位移视为点击不干扰事件。
 *
 * 参考: https://github.com/electron/electron/issues/1354#issuecomment-1356330873
 */
function makeWin32WindowFullyDraggable(
    browserWindow: BrowserWindow,
    options: IWindowDragOptions,
    draggingSet: Set<BrowserWindow>,
): void {
    const { height, width, getWindowSize, onDragEnd } = options;

    const initialPos = { x: 0, y: 0, height, width };
    let dragging = false;
    let pastThreshold = false;
    let cachePosition: IPoint | null = null;

    browserWindow.hookWindowMessage(WM_LBUTTONUP, () => {
        dragging = false;
        draggingSet.delete(browserWindow);
        if (pastThreshold && cachePosition !== null) {
            onDragEnd?.(cachePosition);
        }
        pastThreshold = false;
        cachePosition = null;
    });

    browserWindow.hookWindowMessage(WM_MOUSEMOVE, (wParam: Buffer, lParam: Buffer) => {
        if (browserWindow.isDestroyed()) {
            return;
        }

        const wParamNumber = wParam.readInt16LE(0);
        if (!(wParamNumber & MK_LBUTTON)) {
            return;
        }

        const x = lParam.readInt16LE(0);
        const y = lParam.readInt16LE(2);

        if (!dragging) {
            dragging = true;
            pastThreshold = false;

            let initWidth = width;
            let initHeight = height;
            if (getWindowSize) {
                const size = getWindowSize();
                initWidth = size.width;
                initHeight = size.height;
            }

            initialPos.x = x;
            initialPos.y = y;
            initialPos.height = initHeight;
            initialPos.width = initWidth;
            return;
        }

        // 未超过阈值时不移动窗口，避免干扰点击
        if (!pastThreshold) {
            if (Math.abs(x - initialPos.x) + Math.abs(y - initialPos.y) < DRAG_THRESHOLD) {
                return;
            }
            pastThreshold = true;
            draggingSet.add(browserWindow);
        }

        cachePosition = {
            x: x + browserWindow.getPosition()[0] - initialPos.x,
            y: y + browserWindow.getPosition()[1] - initialPos.y,
        };

        browserWindow.setBounds({
            x: cachePosition.x,
            y: cachePosition.y,
            height: initialPos.height,
            width: initialPos.width,
        });
    });
}

// ─── 模块实现 ───

/** 安全超时：防止渲染进程崩溃导致 interval 永远运行 */
const MAX_DRAG_DURATION = 60_000; // 60 秒

class WindowDrag {
    private isSetup = false;

    /** 已注册拖拽的窗口及其选项 */
    private registeredWindows = new Map<BrowserWindow, IWindowDragOptions>();

    /** macOS/Linux: 拖拽期间的光标轮询定时器 */
    private dragIntervals = new Map<BrowserWindow, ReturnType<typeof setInterval>>();

    /** macOS/Linux: 安全超时定时器 */
    private dragTimeouts = new Map<BrowserWindow, ReturnType<typeof setTimeout>>();

    /** Win32: 正在拖拽中的窗口集合 */
    private win32DraggingWindows = new Set<BrowserWindow>();

    public setup(): void {
        if (this.isSetup) {
            return;
        }

        this.registerIpcHandlers();

        this.isSetup = true;
    }

    /**
     * 为指定窗口启用全窗口拖拽。
     *
     * - Win32: 通过 hookWindowMessage 拦截原生消息，无需 IPC
     * - macOS/Linux: 渲染进程检测鼠标拖拽后通知主进程轮询光标
     */
    public setWindowDraggable(window: BrowserWindow, options: IWindowDragOptions): void {
        if (process.platform === 'win32') {
            makeWin32WindowFullyDraggable(window, options, this.win32DraggingWindows);
        } else {
            this.registeredWindows.set(window, options);
            window.on('closed', () => {
                this.clearDragInterval(window);
                this.registeredWindows.delete(window);
            });
        }
    }

    /**
     * 判断指定窗口是否正在被拖拽。
     */
    public isDragging(win: BrowserWindow): boolean {
        if (process.platform === 'win32') {
            return this.win32DraggingWindows.has(win);
        }
        return this.dragIntervals.has(win);
    }

    private registerIpcHandlers(): void {
        // macOS/Linux: 渲染进程通知拖拽开始，主进程轮询光标位置移动窗口
        ipcMain.on(IPC.START_DRAG, (_evt, offset: IPoint) => {
            const win = BrowserWindow.fromWebContents(_evt.sender);
            if (!win || win.isDestroyed()) return;

            const metadata = this.registeredWindows.get(win);
            if (!metadata) return;

            this.clearDragInterval(win);

            // 记录拖拽开始时的窗口尺寸，拖拽期间不变
            let dragWidth = metadata.width;
            let dragHeight = metadata.height;
            if (metadata.getWindowSize) {
                const size = metadata.getWindowSize();
                dragWidth = size.width;
                dragHeight = size.height;
            }

            const interval = setInterval(() => {
                if (win.isDestroyed()) {
                    this.clearDragInterval(win);
                    return;
                }
                const cursor = screen.getCursorScreenPoint();
                win.setBounds({
                    x: cursor.x - offset.x,
                    y: cursor.y - offset.y,
                    width: dragWidth,
                    height: dragHeight,
                });
            }, 16); // ~60fps

            this.dragIntervals.set(win, interval);

            // 安全超时：防止渲染进程崩溃/未发 stop 导致 interval 泄漏
            const timeout = setTimeout(() => {
                this.clearDragInterval(win);
            }, MAX_DRAG_DURATION);
            this.dragTimeouts.set(win, timeout);
        });

        // macOS/Linux: 拖拽结束，停止轮询并通知回调
        ipcMain.on(IPC.STOP_DRAG, (_evt) => {
            const win = BrowserWindow.fromWebContents(_evt.sender);
            if (!win) return;

            this.clearDragInterval(win);

            const metadata = this.registeredWindows.get(win);
            if (!metadata || win.isDestroyed()) return;

            const [x, y] = win.getPosition();
            metadata.onDragEnd?.({ x, y });
        });
    }

    private clearDragInterval(win: BrowserWindow): void {
        const interval = this.dragIntervals.get(win);
        if (interval) {
            clearInterval(interval);
            this.dragIntervals.delete(win);
        }
        const timeout = this.dragTimeouts.get(win);
        if (timeout) {
            clearTimeout(timeout);
            this.dragTimeouts.delete(win);
        }
    }
}

const windowDrag = new WindowDrag();
export default windowDrag;
