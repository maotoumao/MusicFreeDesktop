/**
 * NativeTrayMenu — 原生 Windows 托盘菜单封装
 *
 * 职责:
 *  1. 封装 CustomTrayMenu.node 原生模块的生命周期（加载、初始化、销毁）
 *  2. 将 AppState / AppConfig 映射为 native 模块的数据格式
 *  3. 处理封面图片的获取与 BGRA32 转换
 *  4. 将 native 事件转发为 appSync 指令
 *
 * 设计:
 *  - 通过 static create() 工厂方法构造，内部处理加载/初始化失败并返回 null
 *  - 由 AppTray 持有实例，不对外暴露 native 模块细节
 */

import axios from 'axios';
import fsp from 'fs/promises';
import path from 'path';

import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IAppConfig } from '@appTypes/infra/appConfig';
import type { IAppState } from '@appTypes/infra/appSync';
import type {
    MenuItemOrSeparator,
    TrayMenuEvent,
    EventPayload,
} from '@main/native_modules/CustomTrayMenu/CustomTrayMenu.node';
import { app } from 'electron';
import appSync from '@infra/appSync/main';
import appConfig from '@infra/appConfig/main';
import i18n from '@infra/i18n/main';
import logger from '@infra/logger/main';
import { PlayerState, REPEAT_MODE_NEXT, RepeatMode, ResourceName } from '@common/constant';

// ─── 常量 ───

/** 封面尺寸（像素） */
const COVER_SIZE = 80;

/** 封面下载超时（毫秒） */
const COVER_FETCH_TIMEOUT_MS = 5000;

/** 菜单项 ID */
const MENU_ID = {
    DESKTOP_LYRIC: 'desktop-lyric',
    LOCK_LYRIC: 'lock-lyric',
    MINIMODE: 'minimode',
    SETTINGS: 'settings',
    EXIT: 'exit',
} as const;

// ─── NativeTrayMenu ───

/** 封面 BGRA32 处理结果 */
interface CoverResult {
    data: Buffer;
    width: number;
    height: number;
}

class NativeTrayMenu {
    private module: typeof import('@main/native_modules/CustomTrayMenu/CustomTrayMenu.node');
    private windowManager: IWindowManager;
    private defaultCoverCache: Buffer | null = null;
    private defaultCoverResultCache: CoverResult | null = null;

    /** 上次使用的封面 artwork URL */
    private lastCoverArtwork: string | null = null;
    /** 上次成功获取的封面处理结果 */
    private lastCoverResult: CoverResult | null = null;
    /** 封面异步获取序列号，用于丢弃过期请求 */
    private coverUpdateSeq = 0;

    private constructor(
        module: typeof import('@main/native_modules/CustomTrayMenu/CustomTrayMenu.node'),
        windowManager: IWindowManager,
    ) {
        this.module = module;
        this.windowManager = windowManager;
    }

    /**
     * 工厂方法：加载并初始化原生托盘菜单。
     * 任一步骤失败均返回 null，由调用方静默回退。
     */
    static async create(windowManager: IWindowManager): Promise<NativeTrayMenu | null> {
        try {
            const mod = await import('@main/native_modules/CustomTrayMenu/CustomTrayMenu.node');

            const instance = new NativeTrayMenu(mod, windowManager);

            const result = mod.initialize((event: TrayMenuEvent, payload: EventPayload) => {
                instance.handleEvent(event, payload, windowManager);
            });

            if (!result.success) {
                logger.error('CustomTrayMenu initialize failed', result.error);
                return null;
            }

            return instance;
        } catch (ex) {
            logger.error('Failed to load CustomTrayMenu native module', ex);
            return null;
        }
    }

    // ─── 公共接口 ───

    /**
     * 根据当前 AppState 和 AppConfig 更新菜单内容。
     * 同时更新 Now Playing 区域和菜单项列表。
     */
    async update(state: Partial<IAppState>, config: IAppConfig): Promise<void> {
        try {
            await this.updateNowPlaying(state);
        } catch (ex) {
            logger.error('Failed to update now playing', ex);
        }
        try {
            this.updateMenuItems(config);
        } catch (ex) {
            logger.error('Failed to update menu items', ex);
        }
    }

    /** 在指定位置显示菜单 */
    showAt(): void {
        this.module.showAt();
    }

    /** 释放资源 */
    destroy(): void {
        try {
            this.module.destroy();
        } catch (ex) {
            logger.error('Failed to destroy native tray menu', ex);
        }
    }

    // ─── 内部方法 ───

    /**
     * 更新 Now Playing 头部区域。
     * 封面未变时直接使用缓存；封面变化时先用默认封面立即更新，
     * 再异步获取真实封面后二次更新，通过序列号防止过期请求覆盖。
     */
    private async updateNowPlaying(state: Partial<IAppState>): Promise<void> {
        const { musicItem, playerState, isFavorite, repeatMode } = state;
        const artwork = musicItem?.artwork ?? null;
        const needFetchCover = artwork !== this.lastCoverArtwork;

        // 封面未变：直接用缓存更新
        if (!needFetchCover && this.lastCoverResult) {
            this.applyNowPlaying(
                musicItem,
                playerState,
                isFavorite,
                repeatMode,
                this.lastCoverResult,
            );
            return;
        }

        // 封面变化：先用默认封面立即更新，保证信息及时刷新
        const defaultCover = await this.getDefaultCoverResult();
        this.applyNowPlaying(musicItem, playerState, isFavorite, repeatMode, defaultCover);

        // 无封面 URL 时无需异步获取
        if (!artwork) {
            this.lastCoverArtwork = artwork;
            this.lastCoverResult = defaultCover;
            return;
        }

        // 异步获取真实封面
        const seq = ++this.coverUpdateSeq;
        const coverResult = await this.fetchCover(artwork);
        if (seq !== this.coverUpdateSeq) return;

        this.lastCoverArtwork = artwork;
        this.lastCoverResult = coverResult;

        // 获取最新状态进行二次更新
        const current = appSync.getAppState();
        this.applyNowPlaying(
            current.musicItem as IMusic.IMusicItem | null | undefined,
            current.playerState as PlayerState | undefined,
            current.isFavorite as boolean | undefined,
            current.repeatMode as RepeatMode | undefined,
            coverResult,
        );
    }

    /** 将数据写入 native 模块 */
    private applyNowPlaying(
        musicItem: IMusic.IMusicItem | null | undefined,
        playerState: PlayerState | undefined,
        isFavorite: boolean | undefined,
        repeatMode: RepeatMode | undefined,
        cover: CoverResult,
    ): void {
        this.module.updateNowPlaying({
            title: musicItem
                ? musicItem.title || i18n.t('media.unknown_title')
                : i18n.t('playback.not_playing'),
            artist: musicItem?.artist ?? '',
            coverBuffer: cover.data,
            coverWidth: cover.width,
            coverHeight: cover.height,
            isPlaying: playerState === PlayerState.Playing,
            isLiked: isFavorite ?? false,
            playMode: repeatMode,
        });
    }

    /** 更新菜单项列表 */
    private updateMenuItems(config: IAppConfig): void {
        const items: MenuItemOrSeparator[] = [];
        const isDesktopLyricEnabled = config['lyric.enableDesktopLyric'] ?? false;

        items.push({
            id: MENU_ID.DESKTOP_LYRIC,
            label: isDesktopLyricEnabled
                ? i18n.t('lyric.close_desktop')
                : i18n.t('lyric.open_desktop'),
        });

        if (isDesktopLyricEnabled) {
            const isLocked = config['lyric.lockLyric'] ?? false;
            items.push({
                id: MENU_ID.LOCK_LYRIC,
                label: isLocked ? i18n.t('lyric.unlock_desktop') : i18n.t('lyric.lock_desktop'),
            });
        }

        items.push({ type: 'separator' });

        items.push({
            id: MENU_ID.MINIMODE,
            label: this.windowManager.isMinimode()
                ? i18n.t('app.exit_minimode')
                : i18n.t('app.enter_minimode'),
        });

        items.push({
            id: MENU_ID.SETTINGS,
            label: i18n.t('settings.title'),
        });

        items.push({ type: 'separator' });

        items.push({
            id: MENU_ID.EXIT,
            label: i18n.t('common.exit'),
            isDestructive: true,
        });

        this.module.setMenuItems(items);
    }

    /** 处理 native 模块事件回调 */
    private handleEvent(
        event: TrayMenuEvent,
        payload: EventPayload,
        windowManager: IWindowManager,
    ): void {
        switch (event) {
            case 'LIKE':
                appSync.sendCommand('like/dislike');
                break;
            case 'PREV':
                appSync.sendCommand('skip-previous');
                break;
            case 'PLAY_PAUSE':
                appSync.sendCommand('play/pause');
                break;
            case 'NEXT':
                appSync.sendCommand('skip-next');
                break;
            case 'PLAY_MODE':
                this.cycleRepeatMode();
                break;
            case 'NOW_PLAYING_CLICKED':
                windowManager.showWindow('main');
                appSync.sendCommand('open-music-detail');
                break;
            case 'MENU_CLICKED':
                if ('menuId' in payload) {
                    this.handleMenuClicked(payload.menuId as string);
                }
                break;
            case 'ERROR':
                logger.error('CustomTrayMenu error', payload);
                break;
        }
    }

    /** 循环切换播放模式 */
    private cycleRepeatMode(): void {
        const current = (appSync.getAppState() as Partial<IAppState>).repeatMode;
        appSync.sendCommand('set-repeat-mode', REPEAT_MODE_NEXT[current ?? RepeatMode.Queue]);
    }

    /** 处理菜单项点击 */
    private handleMenuClicked(menuId: string): void {
        switch (menuId) {
            case MENU_ID.DESKTOP_LYRIC: {
                const current = appConfig.getConfigByKey('lyric.enableDesktopLyric');
                appConfig.setConfig({ 'lyric.enableDesktopLyric': !current });
                break;
            }
            case MENU_ID.LOCK_LYRIC: {
                const current = appConfig.getConfigByKey('lyric.lockLyric');
                appConfig.setConfig({ 'lyric.lockLyric': !current });
                break;
            }
            case MENU_ID.MINIMODE: {
                if (this.windowManager.isMinimode()) {
                    this.windowManager.exitMinimode();
                } else {
                    this.windowManager.enterMinimode();
                }
                break;
            }
            case MENU_ID.SETTINGS: {
                this.windowManager.showWindow('main');
                appSync.sendCommand('navigate', 'setting');
                break;
            }
            case MENU_ID.EXIT: {
                app.exit(0);
                break;
            }
        }
    }

    // ─── 封面处理 ───

    /** 获取并转换封面为 BGRA32 raw buffer */
    private async fetchCover(src?: string | null): Promise<CoverResult> {
        let buffer: Buffer;

        if (!src) {
            buffer = await this.getDefaultCover();
        } else if (src.startsWith('http')) {
            try {
                buffer = (
                    await axios.get(src, {
                        responseType: 'arraybuffer',
                        timeout: COVER_FETCH_TIMEOUT_MS,
                    })
                ).data;
            } catch {
                buffer = await this.getDefaultCover();
            }
        } else if (src.startsWith('data:image')) {
            const base64Match = src.match(/^data:image\/[^;]+;base64,(.+)$/);
            buffer = base64Match
                ? Buffer.from(base64Match[1], 'base64')
                : await this.getDefaultCover();
        } else {
            buffer = await this.getDefaultCover();
        }

        const { default: sharp } = await import('sharp');
        const result = await sharp(buffer)
            .resize(COVER_SIZE, COVER_SIZE, { fit: 'cover' })
            .ensureAlpha(1)
            .raw()
            .toBuffer({ resolveWithObject: true });

        // RGBA → BGRA：交换 R 和 B 通道
        const data = result.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            data[i] = data[i + 2];
            data[i + 2] = r;
        }

        return {
            data,
            width: result.info.width,
            height: result.info.height,
        };
    }

    /** 获取默认封面原始文件（带缓存） */
    private async getDefaultCover(): Promise<Buffer> {
        if (!this.defaultCoverCache) {
            this.defaultCoverCache = await fsp.readFile(
                path.resolve(globalContext.appPath.res, ResourceName.DEFAULT_ALBUM_COVER_IMAGE),
            );
        }
        return this.defaultCoverCache;
    }

    /** 获取默认封面的 BGRA32 处理结果（带缓存） */
    private async getDefaultCoverResult(): Promise<CoverResult> {
        if (!this.defaultCoverResultCache) {
            this.defaultCoverResultCache = await this.fetchCover(null);
        }
        return this.defaultCoverResultCache;
    }
}

export default NativeTrayMenu;
