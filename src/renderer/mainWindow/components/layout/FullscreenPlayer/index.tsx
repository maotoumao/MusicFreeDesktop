// ============================================================================
// FullscreenPlayer — 全屏播放详情页
// ============================================================================

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MoreHorizontal, Languages } from 'lucide-react';
import { DesktopLyric } from '@renderer/common/icons';
import { useAtomValue } from 'jotai/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import { transition as motionTransition } from '@common/motionTokens';
import { useCurrentMusic, useLyric } from '@renderer/mainWindow/core/trackPlayer/hooks';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import { syncKV } from '@renderer/common/kvStore';
import defaultCover from '@assets/imgs/album-cover.jpg';
import { fullscreenPlayerOpenAtom, closeFullscreenPlayer } from './fullscreenPlayerState';
import LyricPanel from './LyricPanel';
import LyricSettingsPopover from './LyricSettingsPopover';
import PlaybackControls from './PlaybackControls';
import './index.scss';

// ─── 动画配置 ───

const overlayVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: { y: 0, opacity: 1 },
};

/**
 * FullscreenPlayer — 布局组件
 *
 * 全屏覆盖层，展示当前播放歌曲的封面、歌词。
 * 从底部滑入，Escape 或点击 Header 返回按钮关闭。
 */
const FullscreenPlayer = memo(function FullscreenPlayer() {
    const open = useAtomValue(fullscreenPlayerOpenAtom);
    const currentMusic = useCurrentMusic();
    const { t } = useTranslation();

    // 歌词设置状态
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [fontScale, setFontScale] = useState(() => syncKV.get('player.lyricFontScale') ?? 1);
    const [showTranslation, setShowTranslation] = useState(
        () => syncKV.get('player.showLyricTranslation') ?? true,
    );

    // Escape 关闭
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                closeFullscreenPlayer();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    // 关闭时收起设置面板
    useEffect(() => {
        if (!open) {
            setSettingsOpen(false);
        }
    }, [open]);

    /** 字号缩放变化 — 持久化到 SyncKV */
    const handleFontScaleChange = useCallback((scale: number) => {
        setFontScale(scale);
        syncKV.set('player.lyricFontScale', scale);
    }, []);

    /** 翻译开关变化 — 持久化到 SyncKV */
    const handleShowTranslationChange = useCallback((show: boolean) => {
        setShowTranslation(show);
        syncKV.set('player.showLyricTranslation', show);
    }, []);

    /** 关闭设置面板 */
    const handleSettingsClose = useCallback(() => {
        setSettingsOpen(false);
    }, []);

    const settingsTriggerRef = useRef<HTMLButtonElement>(null);

    const artworkSrc = currentMusic?.artwork;

    // 歌词状态（翻译可用性）
    const lyricState = useLyric();
    const hasTranslation = lyricState?.parser?.hasTranslation ?? false;

    // 桌面歌词状态
    const [desktopLyricEnabled, setDesktopLyricEnabled] = useConfigValue(
        'lyric.enableDesktopLyric',
    );

    const handleDesktopLyricToggle = useCallback(() => {
        setDesktopLyricEnabled(!desktopLyricEnabled);
    }, [desktopLyricEnabled, setDesktopLyricEnabled]);

    const handleTranslationToggle = useCallback(() => {
        handleShowTranslationChange(!showTranslation);
    }, [showTranslation, handleShowTranslationChange]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className="l-fullscreen-player"
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    transition={motionTransition.slow}
                >
                    {/* ── 动态模糊背景 ── */}
                    <div className="l-fullscreen-player__bg">
                        {artworkSrc && (
                            <img
                                className="l-fullscreen-player__bg-img"
                                src={artworkSrc}
                                alt=""
                                draggable={false}
                            />
                        )}
                        <div className="l-fullscreen-player__bg-overlay" />
                    </div>

                    {/* ── Header ── */}
                    <div className="l-fullscreen-player__header">
                        <button
                            type="button"
                            className="l-fullscreen-player__close-btn"
                            onClick={closeFullscreenPlayer}
                            title={t('common.collapse')}
                            aria-label={t('playback.collapse_player_detail')}
                        >
                            <ChevronDown size={32} />
                        </button>
                    </div>

                    {/* ── Body — 左封面 + 右歌词 ── */}
                    <div className="l-fullscreen-player__body">
                        {/* 左: 封面 */}
                        <div className="l-fullscreen-player__artwork-wrapper">
                            <div className="l-fullscreen-player__artwork">
                                <img
                                    className="l-fullscreen-player__artwork-img"
                                    src={artworkSrc || defaultCover}
                                    alt={currentMusic?.title ?? ''}
                                    draggable={false}
                                    onError={(e) => {
                                        const img = e.target as HTMLImageElement;
                                        if (!img.src.endsWith(defaultCover)) {
                                            img.src = defaultCover;
                                        }
                                    }}
                                />
                            </div>

                            {/* 播放控制面板 */}
                            <PlaybackControls />
                        </div>

                        {/* 右: 歌词区域 */}
                        <div className="l-fullscreen-player__right">
                            {/* 歌曲信息 */}
                            <div className="l-fullscreen-player__song-info">
                                <h2 className="l-fullscreen-player__song-title">
                                    {currentMusic?.title ?? t('playback.not_playing')}
                                </h2>
                                <p className="l-fullscreen-player__song-artist">
                                    {currentMusic?.artist && (
                                        <>
                                            {currentMusic.artist}
                                            {currentMusic.album && (
                                                <>
                                                    <span className="l-fullscreen-player__dot">
                                                        •
                                                    </span>
                                                    {currentMusic.album}
                                                </>
                                            )}
                                        </>
                                    )}
                                </p>
                            </div>

                            {/* 歌词面板 */}
                            <div className="l-fullscreen-player__lyric-container">
                                <LyricPanel
                                    fontScale={fontScale}
                                    showTranslation={showTranslation}
                                />

                                {/* 右下角工具栏：翻译 / 桌面歌词 / 设置 */}
                                <div className="l-fullscreen-player__settings-anchor">
                                    <button
                                        className={cn(
                                            'l-fullscreen-player__tool-btn',
                                            showTranslation && hasTranslation && 'is-active',
                                            !hasTranslation && 'is-disabled',
                                        )}
                                        type="button"
                                        title={
                                            !hasTranslation
                                                ? t('lyric.no_translation')
                                                : showTranslation
                                                  ? t('lyric.hide_translation')
                                                  : t('lyric.show_translation')
                                        }
                                        aria-label={t('lyric.translation')}
                                        aria-pressed={showTranslation && hasTranslation}
                                        disabled={!hasTranslation}
                                        onClick={handleTranslationToggle}
                                    >
                                        <Languages size={16} />
                                    </button>
                                    <button
                                        className={cn(
                                            'l-fullscreen-player__tool-btn',
                                            desktopLyricEnabled && 'is-active',
                                        )}
                                        type="button"
                                        title={
                                            desktopLyricEnabled
                                                ? t('lyric.close_desktop')
                                                : t('lyric.open_desktop')
                                        }
                                        aria-label={t('playback.desktop_lyric')}
                                        aria-pressed={!!desktopLyricEnabled}
                                        onClick={handleDesktopLyricToggle}
                                    >
                                        <DesktopLyric size={16} />
                                    </button>
                                    <button
                                        ref={settingsTriggerRef}
                                        type="button"
                                        className={cn(
                                            'l-fullscreen-player__settings-trigger',
                                            settingsOpen && 'is-active',
                                        )}
                                        onClick={() => setSettingsOpen((prev) => !prev)}
                                        title={t('lyric.settings')}
                                        aria-label={t('lyric.settings')}
                                    >
                                        <MoreHorizontal size={16} />
                                    </button>

                                    <LyricSettingsPopover
                                        open={settingsOpen}
                                        onClose={handleSettingsClose}
                                        triggerRef={settingsTriggerRef}
                                        fontScale={fontScale}
                                        onFontScaleChange={handleFontScaleChange}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
});

export default FullscreenPlayer;
