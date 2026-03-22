/**
 * AppThumbar — Windows 任务栏缩略图管理器
 *
 * 职责:
 *  1. 设置缩略图按钮（上一首 / 播放|暂停 / 下一首）
 *  2. 设置缩略图预览图片（专辑封面，仅 artwork 模式）
 *  3. 设置缩略图窗口标题（当前播放歌曲信息）
 *  4. 根据播放状态 / 语言切换自动刷新按钮
 *
 * 设计:
 *  - 类单例，由 main/index.ts 在 app ready 后调用 setup() 初始化
 *  - 仅在 Windows 平台生效
 *  - 支持两种模式（setup 时从配置读取，不支持运行时切换）:
 *    - window: 使用 Electron 内置 BrowserWindow thumbar API，任务栏预览为窗口截图
 *    - artwork: 使用原生模块 TaskbarManager，任务栏预览为专辑封面
 *  - 直接引用 infra 模块（appConfig / appSync / i18n），仅注入 windowManager
 */

import path from 'path';
import fsp from 'fs/promises';
import axios from 'axios';
import { nativeImage } from 'electron';

import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
import appConfig from '@infra/appConfig/main';
import appSync from '@infra/appSync/main';
import i18n from '@infra/i18n/main';
import logger from '@infra/logger/main';
import { PlayerState, ResourceName } from '@common/constant';

// ─── 常量 ───

/** 缩略图预览尺寸（像素），仅 artwork 模式使用 */
const THUMB_SIZE = 106;

/** 专辑封面下载超时（毫秒） */
const ARTWORK_FETCH_TIMEOUT_MS = 5000;

// ─── AppThumbar 实现 ───

class AppThumbar {
    private windowManager: IWindowManager | null = null;

    /** 当前模式，在 setup() 时从配置读取并锁定，不支持运行时切换 */
    private mode: 'window' | 'artwork' = 'window';

    // window 模式专用
    private iconCache = new Map<string, Electron.NativeImage>();

    // artwork 模式专用
    private artworkInitialized = false;
    private defaultAlbumCoverCache: Buffer | null = null;
    private ttmCache:
        | typeof import('@main/native_modules/TaskbarManager/TaskbarManager.node')
        | null = null;

    // ─── 公共接口 ───

    /**
     * 初始化 ThumbsBar。
     * 仅在 Windows 平台生效；其他平台调用后直接返回。
     */
    public setup(windowManager: IWindowManager): void {
        if (process.platform !== 'win32') {
            return;
        }

        this.windowManager = windowManager;
        this.mode = appConfig.getConfigByKey('normal.taskbarThumb') ?? 'window';

        windowManager.on('create', async ({ windowType }) => {
            if (windowType === 'main') {
                if (this.mode === 'artwork') {
                    await this.initTaskbarGroup();
                }

                const state = appSync.getAppState();
                const isPlaying = state.playerState === PlayerState.Playing;

                await this.createThumbBarButtons(isPlaying);

                if (this.mode === 'artwork') {
                    void this.setThumbImage(state.musicItem?.artwork);
                }

                void this.updateWindowTitle(state.musicItem);
            }
        });

        appSync.onStateChange((_, patch) => {
            if ('musicItem' in patch) {
                if (this.mode === 'artwork') {
                    void this.setThumbImage(patch.musicItem?.artwork);
                }

                void this.updateWindowTitle(patch.musicItem);
            }

            if ('playerState' in patch) {
                void this.createThumbBarButtons(patch.playerState === PlayerState.Playing);
            }
        });

        i18n.on('languageChanged', () => {
            const state = appSync.getAppState();
            void this.createThumbBarButtons(state.playerState === PlayerState.Playing);
        });
    }

    // ─── 辅助方法 ───

    /** 获取 res 目录下的资源绝对路径 */
    private getResPath(resourceName: string): string {
        return path.resolve(globalContext.appPath.res, resourceName);
    }

    /** 获取 NativeImage 图标（带缓存） */
    private getIcon(resourceName: string): Electron.NativeImage {
        let icon = this.iconCache.get(resourceName);
        if (!icon) {
            icon = nativeImage.createFromPath(this.getResPath(resourceName));
            this.iconCache.set(resourceName, icon);
        }
        return icon;
    }

    /** 格式化歌曲标题 */
    private formatMusicTitle(musicItem?: IMusicItemSlim | null): string {
        if (!musicItem) {
            return 'MusicFree';
        }
        return musicItem.artist ? `${musicItem.title} - ${musicItem.artist}` : musicItem.title;
    }

    // ─── 调度方法 ───

    /**
     * 创建 / 更新任务栏缩略图按钮组（3 个按钮）。
     * 语言切换时需要整体重建（tooltip 变化）。
     */
    private async createThumbBarButtons(isPlaying: boolean): Promise<void> {
        if (this.mode === 'window') {
            this.setThumbBarButtonsElectron(isPlaying);
        } else {
            await this.setThumbBarButtonsNative(isPlaying);
        }
    }

    /** 更新缩略图窗口标题（显示当前播放歌曲信息）。 */
    private async updateWindowTitle(musicItem?: IMusicItemSlim | null): Promise<void> {
        if (this.mode === 'window') {
            this.setWindowTitleElectron(musicItem);
        } else {
            await this.setWindowTitleNative(musicItem);
        }
    }

    // ─── window 模式 ───

    /** 使用 Electron 内置 API 设置缩略图按钮 */
    private setThumbBarButtonsElectron(isPlaying: boolean): void {
        const mainWindow = this.windowManager?.__getWindowUnsafe('main');
        if (!mainWindow) {
            return;
        }

        try {
            mainWindow.setThumbarButtons([
                {
                    icon: this.getIcon(ResourceName.SKIP_LEFT_ICO),
                    tooltip: i18n.t('playback.previous'),
                    click() {
                        appSync.sendCommand('skip-previous');
                    },
                },
                {
                    icon: this.getIcon(isPlaying ? ResourceName.PAUSE_ICO : ResourceName.PLAY_ICO),
                    tooltip: isPlaying ? i18n.t('playback.pause') : i18n.t('playback.play'),
                    click() {
                        appSync.sendCommand('play/pause');
                    },
                },
                {
                    icon: this.getIcon(ResourceName.SKIP_RIGHT_ICO),
                    tooltip: i18n.t('playback.next'),
                    click() {
                        appSync.sendCommand('skip-next');
                    },
                },
            ]);
        } catch (ex) {
            logger.error('Failed to set thumbbar buttons', ex);
        }
    }

    /** 使用 Electron BrowserWindow.setTitle 设置窗口标题 */
    private setWindowTitleElectron(musicItem?: IMusicItemSlim | null): void {
        const mainWindow = this.windowManager?.__getWindowUnsafe('main');
        if (!mainWindow) {
            return;
        }

        try {
            mainWindow.setTitle(this.formatMusicTitle(musicItem));
        } catch (ex) {
            logger.error('Failed to set window title', ex);
        }
    }

    // ─── artwork 模式 ───

    /** 获取默认专辑封面（带缓存） */
    private async getDefaultAlbumCover(): Promise<Buffer> {
        if (!this.defaultAlbumCoverCache) {
            this.defaultAlbumCoverCache = await fsp.readFile(
                this.getResPath(ResourceName.DEFAULT_ALBUM_COVER_IMAGE),
            );
        }
        return this.defaultAlbumCoverCache;
    }

    /** 获取 TaskbarManager 原生模块（带缓存） */
    private async getTaskbarManager() {
        if (!this.ttmCache) {
            this.ttmCache = await import('@main/native_modules/TaskbarManager/TaskbarManager.node');
        }
        return this.ttmCache;
    }

    /**
     * 初始化 TaskbarGroup（创建缩略图窗口）。
     * 仅 artwork 模式使用，需要在主窗口创建后调用一次。
     */
    private async initTaskbarGroup(): Promise<void> {
        if (this.artworkInitialized) {
            return;
        }

        const mainWindow = this.windowManager?.__getWindowUnsafe('main');
        if (!mainWindow) {
            return;
        }

        try {
            const hwnd = mainWindow.getNativeWindowHandle().readBigUInt64LE(0);
            const iconPath = this.getResPath(ResourceName.LOGO_ICO);
            const ttm = await this.getTaskbarManager();

            ttm.createTaskbarGroup(hwnd, iconPath);
            ttm.setCloseHandler(() => {
                this.windowManager?.closeWindow('main');
            });
            this.artworkInitialized = true;
        } catch (ex) {
            logger.error('Failed to init TaskbarGroup', ex);
        }
    }

    /** 使用原生模块设置缩略图按钮 */
    private async setThumbBarButtonsNative(isPlaying: boolean): Promise<void> {
        if (!this.artworkInitialized) {
            return;
        }

        try {
            const ttm = await this.getTaskbarManager();

            ttm.setThumbarButtons([
                {
                    icon: this.getResPath(ResourceName.SKIP_LEFT_ICO),
                    tooltip: i18n.t('playback.previous'),
                    click() {
                        appSync.sendCommand('skip-previous');
                    },
                },
                {
                    icon: this.getResPath(
                        isPlaying ? ResourceName.PAUSE_ICO : ResourceName.PLAY_ICO,
                    ),
                    tooltip: isPlaying ? i18n.t('playback.pause') : i18n.t('playback.play'),
                    click() {
                        appSync.sendCommand('play/pause');
                    },
                },
                {
                    icon: this.getResPath(ResourceName.SKIP_RIGHT_ICO),
                    tooltip: i18n.t('playback.next'),
                    click() {
                        appSync.sendCommand('skip-next');
                    },
                },
            ]);
        } catch (ex) {
            logger.error('Failed to set thumbbar buttons', ex);
        }
    }

    /** 使用原生模块设置窗口标题 */
    private async setWindowTitleNative(musicItem?: IMusicItemSlim | null): Promise<void> {
        if (!this.artworkInitialized) {
            return;
        }

        try {
            const ttm = await this.getTaskbarManager();
            ttm.setWindowMessage(this.formatMusicTitle(musicItem));
        } catch (ex) {
            logger.error('Failed to set window title', ex);
        }
    }

    /**
     * 设置任务栏缩略图预览图片（专辑封面）。
     * 仅 artwork 模式使用。
     *
     * @param src 图片 URL / base64 / undefined
     */
    private async setThumbImage(src?: string | null): Promise<void> {
        if (!this.artworkInitialized) {
            return;
        }

        try {
            const ttm = await this.getTaskbarManager();

            let buffer: Buffer;
            if (!src) {
                buffer = await this.getDefaultAlbumCover();
            } else if (src.startsWith('http')) {
                try {
                    buffer = (
                        await axios.get(src, {
                            responseType: 'arraybuffer',
                            timeout: ARTWORK_FETCH_TIMEOUT_MS,
                        })
                    ).data;
                } catch {
                    buffer = await this.getDefaultAlbumCover();
                }
            } else if (src.startsWith('data:image')) {
                const base64Match = src.match(/^data:image\/[^;]+;base64,(.+)$/);
                buffer = base64Match
                    ? Buffer.from(base64Match[1], 'base64')
                    : await this.getDefaultAlbumCover();
            } else {
                buffer = await this.getDefaultAlbumCover();
            }

            const { default: sharp } = await import('sharp');
            const result = await sharp(buffer)
                .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
                .ensureAlpha(1)
                .raw()
                .toBuffer({ resolveWithObject: true });

            ttm.sendIconicRepresentation({ width: THUMB_SIZE, height: THUMB_SIZE }, result.data);
        } catch (ex) {
            logger.error('Failed to set thumb image', ex);
        }
    }
}

export default new AppThumbar();
