/**
 * AppTray — 系统托盘管理器
 *
 * 职责:
 *  1. 创建和管理系统托盘图标
 *  2. 构建托盘右键菜单（播放控制、桌面歌词、设置、退出等）
 *  3. 根据播放状态 / 配置变更 / 语言切换自动刷新菜单
 *  4. macOS 应用菜单栏设置
 *  5. [win10+] 可选启用原生 Windows 风格托盘菜单（CustomTrayMenu）
 *
 * 设计:
 *  - 类单例，由 main/index.ts 在 app ready 后调用 setup() 初始化
 *  - 直接引用 infra 模块（appConfig / appSync / i18n），仅注入 windowManager
 *  - Native 菜单加载失败时静默回退到 Electron 标准菜单
 */

import {
    app,
    BrowserWindow,
    Menu,
    MenuItem,
    MenuItemConstructorOptions,
    nativeImage,
    Tray,
} from 'electron';
import path from 'path';

import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IAppConfig } from '@appTypes/infra/appConfig';
import appConfig from '@infra/appConfig/main';
import appSync from '@infra/appSync/main';
import i18n from '@infra/i18n/main';
import { PlayerState, RepeatMode } from '@common/constant';
import NativeTrayMenu from './nativeTrayMenu';

// ─── 图标路径 ───

function getLogoPath(): string {
    return path.resolve(globalContext.appPath.res, 'logo.png');
}

// ─── 需要监听的配置 key ───

const OBSERVED_CONFIG_KEYS: Array<keyof IAppConfig> = [
    'lyric.lockLyric',
    'lyric.enableDesktopLyric',
];

// ─── AppTray 实现 ───

class AppTray {
    private tray: Tray | null = null;

    private windowManager!: IWindowManager;

    private isSetup = false;

    private nativeTrayMenu: NativeTrayMenu | null = null;

    private refreshPending = false;

    // ─── 初始化 ───

    public async setup(windowManager: IWindowManager): Promise<void> {
        if (this.isSetup) return;

        this.windowManager = windowManager;

        // macOS: 设置应用菜单栏
        this.setupApplicationMenu();

        // 创建托盘图标
        const tray = new Tray(
            nativeImage.createFromPath(getLogoPath()).resize({
                width: 32,
                height: 32,
            }),
        );

        // 点击行为: 单击/双击展示主窗口，其他平台双击
        tray.on('click', () => {
            this.windowManager.showWindow('main');
        });
        tray.on('double-click', () => {
            this.windowManager.showWindow('main');
        });

        // 调试模式: 连续快速点击 5 次打开所有窗口 DevTools
        this.setupDebugHandler(tray);

        this.tray = tray;

        // [win10+] 尝试初始化原生托盘菜单
        if (
            globalContext.isWin10OrAbove &&
            appConfig.getConfigByKey('normal.useCustomTrayMenu') !== false
        ) {
            this.nativeTrayMenu = await NativeTrayMenu.create(windowManager);
        }

        if (this.nativeTrayMenu) {
            // Native 模式：手动处理右键事件
            tray.on('right-click', (_event) => {
                this.nativeTrayMenu!.showAt();
            });
        }

        // 首次刷新菜单
        this.refreshMenu();

        // 配置变化时刷新菜单
        appConfig.onConfigUpdated((changedConfig) => {
            for (const k of OBSERVED_CONFIG_KEYS) {
                if (k in changedConfig) {
                    this.refreshMenu();
                    return;
                }
            }
        });

        // 播放状态变化时刷新菜单
        appSync.onStateChange((_state, changed) => {
            if (
                'musicItem' in changed ||
                'playerState' in changed ||
                'repeatMode' in changed ||
                'isFavorite' in changed
            ) {
                this.refreshMenu();
            }

            // [darwin] lyricText 变化时更新状态栏歌词
            if ('lyricText' in changed && process.platform === 'darwin') {
                if (appConfig.getConfigByKey('lyric.enableStatusBarLyric')) {
                    this.setTitle(changed.lyricText as string);
                } else {
                    this.setTitle('');
                }
            }
        });

        // 语言变化时刷新菜单
        i18n.on('languageChanged', () => {
            this.setupApplicationMenu();
            this.refreshMenu();
        });

        // minimode 窗口变化时刷新菜单（更新"进入/退出迷你模式"标签）
        windowManager.on('create', ({ windowType }) => {
            if (windowType === 'minimode') this.refreshMenu();
        });
        windowManager.on('close', ({ windowType }) => {
            if (windowType === 'minimode') this.refreshMenu();
        });

        this.isSetup = true;
    }

    /** macOS 状态栏歌曲标题 */
    public setTitle(title: string): void {
        if (!this.tray) return;
        if (!title || !title.length) {
            this.tray.setTitle('');
            return;
        }
        this.tray.setTitle(title.length > 7 ? ` ${title}...` : ` ${title}`);
    }

    /** 释放原生托盘菜单资源 */
    public dispose(): void {
        this.nativeTrayMenu?.destroy();
        this.nativeTrayMenu = null;
    }

    // ─── 菜单刷新调度 ───

    private refreshMenu(): void {
        if (this.refreshPending) return;
        this.refreshPending = true;
        setTimeout(() => {
            this.refreshPending = false;
            this.updateTooltip();

            if (this.nativeTrayMenu) {
                const state = appSync.getAppState();
                const config = appConfig.getConfig();
                void this.nativeTrayMenu.update(state, config);
            } else {
                this.buildElectronMenu();
            }
        }, 0);
    }

    /** 更新托盘图标 tooltip */
    private updateTooltip(): void {
        if (!this.tray) return;

        const { musicItem } = appSync.getAppState() as {
            musicItem?: IMusic.IMusicItem | null;
        };

        if (musicItem) {
            const fullName = `${musicItem.title ?? i18n.t('media.unknown_title')}${
                musicItem.artist ? ` - ${musicItem.artist}` : ''
            }`;
            this.tray.setToolTip(fullName);
        } else {
            this.tray.setToolTip('MusicFree');
        }
    }

    // ─── Electron 标准菜单 ───

    private buildElectronMenu(): void {
        if (!this.tray) return;

        const ctxMenu: Array<MenuItemConstructorOptions | MenuItem> = [];
        const tray = this.tray;

        const { musicItem, playerState, repeatMode } = appSync.getAppState() as {
            musicItem?: IMusic.IMusicItem | null;
            playerState?: PlayerState;
            repeatMode?: RepeatMode;
        };

        // ─── 音乐信息 ───

        if (musicItem) {
            const fullName = `${musicItem.title ?? i18n.t('media.unknown_title')}${
                musicItem.artist ? ` - ${musicItem.artist}` : ''
            }`;

            ctxMenu.push(
                {
                    label: fullName.length > 12 ? fullName.slice(0, 12) + '...' : fullName,
                    click: () => this.openMusicDetail(),
                },
                {
                    label: `${i18n.t('media.platform')}: ${musicItem.platform}`,
                    click: () => this.openMusicDetail(),
                },
            );
        } else {
            ctxMenu.push({
                label: i18n.t('playback.not_playing'),
                enabled: false,
            });
        }

        // ─── 播放控制 ───

        ctxMenu.push(
            {
                label: musicItem
                    ? playerState === PlayerState.Playing
                        ? i18n.t('playback.pause')
                        : i18n.t('playback.play')
                    : i18n.t('playback.play_or_pause'),
                enabled: !!musicItem,
                click: () => {
                    if (!musicItem) return;
                    appSync.sendCommand('play/pause');
                },
            },
            {
                label: i18n.t('playback.previous'),
                enabled: !!musicItem,
                click: () => {
                    appSync.sendCommand('skip-previous');
                },
            },
            {
                label: i18n.t('playback.next'),
                enabled: !!musicItem,
                click: () => {
                    appSync.sendCommand('skip-next');
                },
            },
        );

        // ─── 播放模式 ───

        ctxMenu.push({
            label: i18n.t('playback.repeat_mode'),
            type: 'submenu',
            submenu: Menu.buildFromTemplate([
                {
                    label: i18n.t('playback.repeat_loop'),
                    id: RepeatMode.Loop,
                    type: 'radio',
                    checked: repeatMode === RepeatMode.Loop,
                    click: () => {
                        appSync.sendCommand('set-repeat-mode', RepeatMode.Loop);
                    },
                },
                {
                    label: i18n.t('playback.repeat_queue'),
                    id: RepeatMode.Queue,
                    type: 'radio',
                    checked: repeatMode === RepeatMode.Queue,
                    click: () => {
                        appSync.sendCommand('set-repeat-mode', RepeatMode.Queue);
                    },
                },
                {
                    label: i18n.t('playback.repeat_shuffle'),
                    id: RepeatMode.Shuffle,
                    type: 'radio',
                    checked: repeatMode === RepeatMode.Shuffle,
                    click: () => {
                        appSync.sendCommand('set-repeat-mode', RepeatMode.Shuffle);
                    },
                },
            ]),
        });

        ctxMenu.push({ type: 'separator' });

        // ─── 桌面歌词 ───

        const isDesktopLyricEnabled = appConfig.getConfigByKey('lyric.enableDesktopLyric');
        ctxMenu.push({
            label: isDesktopLyricEnabled
                ? i18n.t('lyric.close_desktop')
                : i18n.t('lyric.open_desktop'),
            click: () => {
                appConfig.setConfig({
                    'lyric.enableDesktopLyric': !isDesktopLyricEnabled,
                });
            },
        });

        if (isDesktopLyricEnabled) {
            const isLocked = appConfig.getConfigByKey('lyric.lockLyric');
            ctxMenu.push({
                label: isLocked ? i18n.t('lyric.unlock_desktop') : i18n.t('lyric.lock_desktop'),
                click: () => {
                    appConfig.setConfig({
                        'lyric.lockLyric': !isLocked,
                    });
                },
            });
        }

        ctxMenu.push({ type: 'separator' });

        // ─── 迷你模式 ───

        ctxMenu.push({
            label: this.windowManager.isMinimode()
                ? i18n.t('app.exit_minimode')
                : i18n.t('app.enter_minimode'),
            click: () => {
                if (this.windowManager.isMinimode()) {
                    this.windowManager.exitMinimode();
                } else {
                    this.windowManager.enterMinimode();
                }
            },
        });

        ctxMenu.push({ type: 'separator' });

        // ─── 其他操作 ───

        ctxMenu.push({
            label: i18n.t('settings.title'),
            click: () => {
                this.windowManager.showWindow('main');
                appSync.sendCommand('navigate', 'setting');
            },
        });

        ctxMenu.push({ type: 'separator' });

        ctxMenu.push({
            label: i18n.t('common.exit'),
            role: process.platform === 'win32' ? undefined : 'quit',
            click: () => {
                app.exit(0);
            },
        });

        tray.setContextMenu(Menu.buildFromTemplate(ctxMenu));
    }

    // ─── macOS 应用菜单 ───

    private setupApplicationMenu(): void {
        if (process.platform === 'darwin') {
            Menu.setApplicationMenu(
                Menu.buildFromTemplate([
                    {
                        label: app.getName(),
                        submenu: [
                            {
                                label: i18n.t('common.about'),
                                role: 'about',
                            },
                            {
                                label: i18n.t('common.exit'),
                                click() {
                                    app.quit();
                                },
                            },
                        ],
                    },
                    {
                        label: i18n.t('common.edit'),
                        submenu: [
                            {
                                label: i18n.t('common.undo'),
                                accelerator: 'Command+Z',
                                role: 'undo',
                            },
                            {
                                label: i18n.t('common.redo'),
                                accelerator: 'Shift+Command+Z',
                                role: 'redo',
                            },
                            { type: 'separator' },
                            {
                                label: i18n.t('common.cut'),
                                accelerator: 'Command+X',
                                role: 'cut',
                            },
                            {
                                label: i18n.t('common.copy'),
                                accelerator: 'Command+C',
                                role: 'copy',
                            },
                            {
                                label: i18n.t('common.paste'),
                                accelerator: 'Command+V',
                                role: 'paste',
                            },
                            { type: 'separator' },
                            {
                                label: i18n.t('common.select_all'),
                                accelerator: 'Command+A',
                                role: 'selectAll',
                            },
                        ],
                    },
                ]),
            );
        } else {
            Menu.setApplicationMenu(null);
        }
    }

    // ─── 调试模式快速点击 ───

    private setupDebugHandler(tray: Tray): void {
        let debugClickCount = 0;
        let debugClickTime = 0;

        tray.on('click', () => {
            const now = Date.now();
            if (now - debugClickTime < 500) {
                debugClickCount++;
                debugClickTime = now;
                if (debugClickCount === 5) {
                    BrowserWindow.getAllWindows().forEach((win) => {
                        win?.webContents?.openDevTools({ mode: 'undocked' });
                    });
                }
            } else {
                debugClickCount = 1;
                debugClickTime = Date.now();
            }
        });
    }

    // ─── 辅助方法 ───

    private openMusicDetail(): void {
        this.windowManager.showWindow('main');
        appSync.sendCommand('open-music-detail');
    }
}

const appTray = new AppTray();
export default appTray;
