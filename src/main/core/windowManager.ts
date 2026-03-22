/**
 * WindowManager — 窗口管理器
 *
 * 职责:
 *  1. 统一管理所有窗口（main / lyric / minimode）的创建、销毁、显示/隐藏
 *  2. 窗口尺寸与位置持久化（通过 AppConfig）
 *  3. 跨窗口 IPC 消息通信与广播
 *  4. 窗口生命周期事件（create / close）的订阅
 *
 * 设计:
 *  - 类单例，由 main/index.ts 在 app ready 后使用
 *  - 窗口配置（BrowserWindowConstructorOptions）与旧版保持一致
 *  - 通过 Map + WindowType 做统一管理，避免每类窗口一套独立方法
 */

import { app, BrowserWindow, Menu, nativeImage, screen, MessagePortMain } from 'electron';
import EventEmitter from 'eventemitter3';
import path from 'path';

import appConfig from '@infra/appConfig/main';
import i18n from '@infra/i18n/main';
import windowDrag from '@infra/windowDrag/main';
import debounce from '@common/debounce';
import throttle from '@common/throttle';
import type { IWindowManager, IWindowEvents, WindowType } from '@appTypes/main/windowManager';

// ─── Forge Webpack 魔法常量 ───

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const LYRIC_WINDOW_WEBPACK_ENTRY: string;
declare const LYRIC_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MINIMODE_WINDOW_WEBPACK_ENTRY: string;
declare const MINIMODE_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// ─── 图标路径 ───

function getLogoPath(): string {
    return path.resolve(globalContext.appPath.res, 'logo.png');
}

// ─── 窗口位置归一化 ───

/** 窗口至少需要多少像素可见才算"在屏幕上" */
const MIN_VISIBLE_PX = 100;

/**
 * 确保窗口在屏幕可视区域内至少有 MIN_VISIBLE_PX 像素可见。
 * 使用 clamp 逻辑将窗口位置约束在合理范围，返回是否发生了修正。
 */
function normalizeWindowPosition(win: BrowserWindow, position: { x: number; y: number }): boolean {
    const display = screen.getDisplayNearestPoint(position);
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
    const windowBounds = win.getBounds();
    const ww = windowBounds.width;
    const wh = windowBounds.height;

    const origX = position.x;
    const origY = position.y;

    // 水平: 确保窗口至少 MIN_VISIBLE_PX 在屏幕内
    const minX = dx - ww + MIN_VISIBLE_PX;
    const maxX = dx + dw - MIN_VISIBLE_PX;
    position.x = Math.max(minX, Math.min(maxX, position.x));

    // 垂直: 确保窗口至少 MIN_VISIBLE_PX 在屏幕内
    const minY = dy - wh + MIN_VISIBLE_PX;
    const maxY = dy + dh - MIN_VISIBLE_PX;
    position.y = Math.max(minY, Math.min(maxY, position.y));

    const needCorrection = position.x !== origX || position.y !== origY;
    if (needCorrection) {
        win.setBounds(
            {
                x: position.x,
                y: position.y,
                width: ww,
                height: wh,
            },
            false,
        );
    }
    return needCorrection;
}

// ─── 歌词窗口尺寸常量（与旧版保持一致） ───

const LYRIC_MIN_WIDTH = 920;
const LYRIC_MIN_HEIGHT = 92; // 60 + 16 * 2
const LYRIC_MAX_HEIGHT = 240; // 60 + 80 * 2

/** 根据字体大小推算歌词窗口高度 */
function evaluateLyricHeight(fontSize?: number): number {
    return 60 + (fontSize || 48) * 2;
}

// ─── 迷你模式窗口尺寸常量 ───

const MINIMODE_WIDTH = 420;
const MINIMODE_HEIGHT = 120;

// ─── WindowManager 实现 ───

class WindowManager implements IWindowManager {
    private windows = new Map<WindowType, BrowserWindow>();
    private ee = new EventEmitter();

    constructor() {
        // ─── Config 驱动窗口：config 是唯一控制源 ───
        appConfig.onConfigUpdated((patch) => {
            if ('lyric.enableDesktopLyric' in patch) {
                if (patch['lyric.enableDesktopLyric']) {
                    this.showWindow('lyric');
                } else {
                    this.closeWindow('lyric');
                }
            }
        });
    }

    // ─── IWindowManager: 窗口生命周期 ───

    public closeWindow(windowType: WindowType): void {
        const win = this.windows.get(windowType);
        if (!win || win.isDestroyed()) return;

        win.close();
        // closed 事件中已做清理
    }

    public closeAllWindows(): void {
        for (const windowType of this.windows.keys()) {
            this.closeWindow(windowType);
        }
    }

    public showWindow(windowType: WindowType): void {
        // 互斥逻辑：主窗口和迷你模式不同时显示
        if (windowType === 'main') {
            this.closeWindow('minimode');
        } else if (windowType === 'minimode') {
            this.hideWindow('main');
        }

        const win = this.windows.get(windowType);
        if (!win || win.isDestroyed()) {
            this.ensureWindow(windowType);
            return;
        }

        if (win.isMinimized()) {
            win.restore();
        } else if (win.isVisible()) {
            win.focus();
        } else {
            win.show();
        }
        win.moveTop();

        if (windowType === 'main') {
            win.setSkipTaskbar(false);
        }
    }

    public hideWindow(windowType: WindowType): void {
        const win = this.windows.get(windowType);
        if (!win || win.isDestroyed()) return;
        win.hide();
    }

    public toggleWindow(windowType: WindowType): void {
        const win = this.windows.get(windowType);
        if (!win || win.isDestroyed()) {
            this.showWindow(windowType);
            return;
        }
        if (win.isVisible()) {
            this.hideWindow(windowType);
        } else {
            this.showWindow(windowType);
        }
    }

    public focusWindow(windowType: WindowType): void {
        const win = this.windows.get(windowType);
        if (!win || win.isDestroyed()) return;

        if (win.isMinimized()) {
            win.restore();
        }
        win.focus();
        win.moveTop();
    }

    // ─── IWindowManager: 窗口状态查询 ───

    public __getWindowUnsafe(windowType: WindowType): BrowserWindow | null {
        const win = this.windows.get(windowType);
        return win && !win.isDestroyed() ? win : null;
    }

    public isWindowExist(windowType: WindowType): boolean {
        const win = this.windows.get(windowType);
        return !!win && !win.isDestroyed();
    }

    public isWindowDestroyed(windowType: WindowType): boolean {
        const win = this.windows.get(windowType);
        return !win || win.isDestroyed();
    }

    public isWindowVisible(windowType: WindowType): boolean {
        const win = this.windows.get(windowType);
        return !!win && !win.isDestroyed() && win.isVisible();
    }

    // ─── IWindowManager: IPC 通信 ───

    public sendTo(type: WindowType, channel: string, ...args: unknown[]): void {
        const win = this.windows.get(type);
        if (!win || win.isDestroyed()) return;
        win.webContents.send(channel, ...args);
    }

    public broadcast(channel: string, ...args: unknown[]): void {
        for (const win of this.windows.values()) {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, ...args);
            }
        }
    }

    public postMessageTo(
        type: WindowType,
        channel: string,
        data: unknown,
        ports?: MessagePortMain[],
    ): void {
        const win = this.windows.get(type);
        if (!win || win.isDestroyed()) return;
        win.webContents.postMessage(channel, data, ports);
    }

    // ─── IWindowManager: 事件订阅 ───

    public on<T extends keyof IWindowEvents>(
        event: T,
        listener: (data: IWindowEvents[T]) => void,
    ): void {
        this.ee.on(event, listener);
    }

    // ─── IWindowManager: 迷你模式 ───

    public enterMinimode(): void {
        if (this.isMinimode()) return;
        this.showWindow('minimode');
    }

    public exitMinimode(): void {
        if (!this.isMinimode()) return;
        this.showWindow('main');
    }

    public isMinimode(): boolean {
        return this.isWindowVisible('minimode');
    }

    // ─── 私有 ───

    /** 确保窗口存在，已存在则聚焦，不存在则创建 */
    private ensureWindow(windowType: WindowType): void {
        const existing = this.windows.get(windowType);
        if (existing && !existing.isDestroyed()) {
            this.focusWindow(windowType);
            return;
        }

        switch (windowType) {
            case 'main':
                this.createMainWindow();
                break;
            case 'lyric':
                this.createLyricWindow();
                break;
            case 'minimode':
                this.createMiniModeWindow();
                break;
        }
    }

    private emit<T extends keyof IWindowEvents>(event: T, data: IWindowEvents[T]): void {
        this.ee.emit(event, data);
    }

    // ─── 私有: 窗口注册 & 清理 ───

    private registerWindow(windowType: WindowType, win: BrowserWindow): void {
        this.windows.set(windowType, win);

        win.webContents.on('context-menu', (_event, params) => {
            if (!params.isEditable) return;

            const { editFlags } = params;
            Menu.buildFromTemplate([
                { label: i18n.t('common.cut'), role: 'cut', enabled: editFlags.canCut },
                { label: i18n.t('common.copy'), role: 'copy', enabled: editFlags.canCopy },
                { label: i18n.t('common.paste'), role: 'paste', enabled: editFlags.canPaste },
                { type: 'separator' },
                {
                    label: i18n.t('common.select_all'),
                    role: 'selectAll',
                    enabled: editFlags.canSelectAll,
                },
            ]).popup({ window: win });
        });

        win.on('closed', () => {
            this.windows.delete(windowType);
            this.emit('close', { windowType });
        });

        this.emit('create', { windowType });
    }

    /**************************** Main Window ***************************/

    private createMainWindow(): void {
        // 清理旧窗口
        const old = this.windows.get('main');
        if (old) {
            old.removeAllListeners();
            if (!old.isDestroyed()) {
                old.close();
                old.destroy();
            }
            this.windows.delete('main');
        }

        const initSize = appConfig.getConfigByKey('private.mainWindowSize');

        const mainWindow = new BrowserWindow({
            height: initSize?.height ?? 860,
            width: initSize?.width ?? 1290,
            minHeight: 760,
            minWidth: 1080,
            webPreferences: {
                preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
                nodeIntegration: true,
                nodeIntegrationInWorker: true,
                webSecurity: false,
                sandbox: false,
                webviewTag: true,
            },
            frame: false,
            icon: nativeImage.createFromPath(getLogoPath()),
        });

        // 窗口尺寸持久化（防抖 300ms）
        const updateWindowSize = debounce(() => {
            if (mainWindow.isDestroyed()) return;
            const [w, h] = mainWindow.getSize();
            appConfig.setConfig({
                'private.mainWindowSize': { width: w, height: h },
            });
        }, 300);
        mainWindow.on('resize', updateWindowSize);

        // 加载主界面（首屏路由由 renderer 侧 React Router index route 处理）
        mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

        // 开发模式下自动打开 DevTools
        if (!app.isPackaged) {
            mainWindow.on('ready-to-show', () => {
                mainWindow.webContents.openDevTools();
            });
        }

        // HTTP Header 注入（兼容插件请求 hack）
        mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
            try {
                const url = new URL(details.url);
                const setHeadersRaw = url.searchParams.get('_setHeaders');
                if (!setHeadersRaw) {
                    throw new Error('No need to hack');
                }

                const originalHeaders = details.requestHeaders ?? {};
                const patchHeaders: Record<string, string> = JSON.parse(
                    decodeURIComponent(setHeadersRaw),
                );
                const requestHeaders: Record<string, string> = {};

                for (const k in originalHeaders) {
                    requestHeaders[k.toLowerCase()] = originalHeaders[k];
                }
                for (const k in patchHeaders) {
                    requestHeaders[k.toLowerCase()] = patchHeaders[k];
                }

                callback({ requestHeaders });
            } catch {
                callback({ requestHeaders: details.requestHeaders });
            }
        });

        // 关闭行为: 最小化到托盘
        mainWindow.on('close', (e) => {
            if (appConfig.getConfigByKey('normal.closeBehavior') === 'minimize') {
                e.preventDefault();
                mainWindow.hide();
                if (process.platform === 'win32') {
                    mainWindow.setSkipTaskbar(true);
                }
            }
        });

        this.registerWindow('main', mainWindow);
    }

    /**************************** Lyric Window ***************************/

    private createLyricWindow(): void {
        const initPosition = appConfig.getConfigByKey('private.lyricWindowPosition');
        const initSize = appConfig.getConfigByKey('private.lyricWindowSize');

        let width = Math.max(initSize?.width ?? LYRIC_MIN_WIDTH, LYRIC_MIN_WIDTH);
        let height = evaluateLyricHeight(appConfig.getConfigByKey('lyric.fontSize') ?? undefined);
        let lyricMaxWidth = 0;

        const lyricWindow = new BrowserWindow({
            height,
            width,
            x: initPosition?.x,
            y: initPosition?.y,
            transparent: true,
            webPreferences: {
                preload: LYRIC_WINDOW_PRELOAD_WEBPACK_ENTRY,
                nodeIntegration: true,
                webSecurity: false,
                sandbox: false,
            },
            minWidth: LYRIC_MIN_WIDTH,
            minHeight: LYRIC_MIN_HEIGHT,
            maxHeight: LYRIC_MAX_HEIGHT,
            resizable: true,
            frame: false,
            thickFrame: true,
            skipTaskbar: true,
            alwaysOnTop: appConfig.getConfigByKey('lyric.alwaysOnTop') ?? true,
            icon: nativeImage.createFromPath(getLogoPath()),
        });

        // 动态限制最大宽度为当前显示器宽度
        const display = screen.getDisplayNearestPoint(lyricWindow.getBounds());
        lyricMaxWidth = display.bounds.width;
        lyricWindow.setMaximumSize(lyricMaxWidth, LYRIC_MAX_HEIGHT);

        // 加载歌词页面
        lyricWindow.loadURL(LYRIC_WINDOW_WEBPACK_ENTRY);

        if (!app.isPackaged) {
            lyricWindow.webContents.openDevTools();
        }

        // 尺寸变化持久化 + 反推字号
        // width/height 立即同步更新，保证 getWindowSize 始终准确（拖拽期间 setBounds 依赖此值）
        // 配置写入走节流，避免高频写文件
        let isResizingFromConfig = false;
        const persistLyricSize = throttle(() => {
            if (lyricWindow.isDestroyed()) return;
            const fontSize = Math.max(Math.min(Math.floor((height - 60) / 2), 80), 12);
            appConfig.setConfig({
                'lyric.fontSize': fontSize,
                'private.lyricWindowSize': { width, height },
            });
        }, 150);
        lyricWindow.on('resize', () => {
            if (windowDrag.isDragging(lyricWindow) || isResizingFromConfig) {
                return;
            }
            const [wWidth, wHeight] = lyricWindow.getSize();
            width = wWidth;
            height = wHeight;
            persistLyricSize();
        });

        // 拖拽支持
        windowDrag.setWindowDraggable(lyricWindow, {
            width,
            height,
            getWindowSize: () => ({ width, height }),
            onDragEnd(point) {
                if (!point) return;
                // 归一化位置，确保拖拽结束后窗口仍在屏幕可视区域内
                normalizeWindowPosition(lyricWindow, point);
                appConfig.setConfig({ 'private.lyricWindowPosition': point });
                // 检测是否切换了显示器，更新 maxWidth
                const currentDisplay = screen.getDisplayNearestPoint(point);
                if (currentDisplay.bounds.width !== lyricMaxWidth) {
                    lyricMaxWidth = currentDisplay.bounds.width;
                    lyricWindow.setMaximumSize(lyricMaxWidth, LYRIC_MAX_HEIGHT);
                }
            },
        });

        // 监听歌词相关配置变更
        const onConfigUpdated = (
            patch: Record<string, unknown>,
            _config: unknown,
            source: string,
        ) => {
            if (lyricWindow.isDestroyed()) return;

            // fontSize: 仅响应来自渲染进程的变更，主进程 resize 反推的字号不需要再 setSize
            if (source === 'renderer' && 'lyric.fontSize' in patch && patch['lyric.fontSize']) {
                const newHeight = evaluateLyricHeight(patch['lyric.fontSize'] as number);
                if (newHeight !== height) {
                    height = newHeight;
                    isResizingFromConfig = true;
                    const bounds = lyricWindow.getBounds();
                    lyricWindow.setBounds({ x: bounds.x, y: bounds.y, width, height });
                    isResizingFromConfig = false;
                }
            }

            // lockLyric: 运行时切换鼠标穿透
            if ('lyric.lockLyric' in patch) {
                if (patch['lyric.lockLyric']) {
                    lyricWindow.setIgnoreMouseEvents(true, { forward: true });
                } else {
                    lyricWindow.setIgnoreMouseEvents(false);
                }
            }

            // alwaysOnTop: 运行时切换置顶
            if ('lyric.alwaysOnTop' in patch) {
                lyricWindow.setAlwaysOnTop(!!patch['lyric.alwaysOnTop']);
            }
        };
        appConfig.onConfigUpdated(onConfigUpdated);
        lyricWindow.on('closed', () => {
            appConfig.offConfigUpdated(onConfigUpdated);
        });

        // 初始化位置归一化 & 锁定状态
        lyricWindow.once('ready-to-show', () => {
            // 无论有无保存位置，都确保窗口在可视区域内
            const pos = initPosition
                ? { ...initPosition }
                : { x: lyricWindow.getBounds().x, y: lyricWindow.getBounds().y };
            if (normalizeWindowPosition(lyricWindow, pos)) {
                appConfig.setConfig({ 'private.lyricWindowPosition': pos });
            }

            const locked = appConfig.getConfigByKey('lyric.lockLyric');
            if (locked) {
                lyricWindow.setIgnoreMouseEvents(true, { forward: true });
            }
        });

        if (process.platform === 'darwin') {
            (lyricWindow as any).invalidateShadow?.();
        }

        this.registerWindow('lyric', lyricWindow);
    }

    /**************************** MiniMode Window ***************************/

    private createMiniModeWindow(): void {
        const initPosition = appConfig.getConfigByKey('private.minimodeWindowPosition');

        const miniWindow = new BrowserWindow({
            height: MINIMODE_HEIGHT,
            width: MINIMODE_WIDTH,
            x: initPosition?.x,
            y: initPosition?.y,
            webPreferences: {
                preload: MINIMODE_WINDOW_PRELOAD_WEBPACK_ENTRY,
                nodeIntegration: true,
                webSecurity: false,
                sandbox: false,
            },
            transparent: true,
            resizable: false,
            frame: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            icon: nativeImage.createFromPath(getLogoPath()),
        });

        // 加载迷你模式页面
        miniWindow.loadURL(MINIMODE_WINDOW_WEBPACK_ENTRY);

        if (!app.isPackaged) {
            miniWindow.on('ready-to-show', () => {
                miniWindow.webContents.openDevTools();
            });
        }

        // 拖拽支持
        windowDrag.setWindowDraggable(miniWindow, {
            width: MINIMODE_WIDTH,
            height: MINIMODE_HEIGHT,
            onDragEnd(point) {
                if (!point) return;
                normalizeWindowPosition(miniWindow, point);
                appConfig.setConfig({ 'private.minimodeWindowPosition': point });
            },
        });

        // 初始化位置归一化
        miniWindow.once('ready-to-show', () => {
            const pos = initPosition
                ? { ...initPosition }
                : { x: miniWindow.getBounds().x, y: miniWindow.getBounds().y };
            if (normalizeWindowPosition(miniWindow, pos)) {
                appConfig.setConfig({ 'private.minimodeWindowPosition': pos });
            }
        });

        this.registerWindow('minimode', miniWindow);
    }
}

const windowManager = new WindowManager();
export default windowManager;
