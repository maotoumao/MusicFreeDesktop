// ============================================================================
// App — 迷你模式根组件
// ============================================================================

import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SkipBack, SkipForward, Play, Pause, Heart, Maximize2 } from 'lucide-react';
import { DesktopLyric } from '@renderer/common/icons';
import { REPEAT_MODE_MAP } from '@renderer/common/repeatModeMap';
import { PlayerState, RepeatMode } from '@common/constant';
import appSyncAuxiliary, { useAppStatePartial } from '@infra/appSync/renderer/auxiliary';
import appConfig from '@infra/appConfig/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import albumImg from '@assets/imgs/album-cover.jpg';
import './index.scss';

/**
 * MiniMode App — 迷你模式窗口根组件
 * @layer layout
 *
 * 设计稿还原（像素级）：
 *   容器: 420×120, rounded-[20px], glass(bg-popover, blur-xl, border-default, shadow-xl)
 *         px-16, flex, items-center, gap-16
 *   封面: 72×72, rounded-2xl(16px), border, shadow
 *   信息: flex-1, min-w-0
 *     标题: text-sm(14px), font-semibold, text-primary, truncate
 *     副标题: text-xs(12px), text-secondary, truncate, mt-1(4px)
 *     进度条: mt-3(12px), h-1.5(6px), rounded-full, no thumb
 *   控制: flex-col, gap-3(12px)
 *     播放: gap-1(4px), prev(32×32) play(36×36, brand) next(32×32)
 *     工具: gap-2(8px), heart(32×32) lyric(32×32) repeat(32×32)
 */
export default function App() {
    const { t } = useTranslation();
    const musicItem = useAppStatePartial('musicItem');
    const playerState = useAppStatePartial('playerState');
    const repeatMode = useAppStatePartial('repeatMode');
    const progress = useAppStatePartial('progress');
    const isFavorite = useAppStatePartial('isFavorite');

    const [enableDesktopLyric] = useConfigValue('lyric.enableDesktopLyric');

    const isPlaying = playerState === PlayerState.Playing;
    const currentRepeatMode = repeatMode ?? RepeatMode.Queue;
    const { Icon: RepeatIcon, next: nextRepeatMode } = REPEAT_MODE_MAP[currentRepeatMode];

    // 进度百分比
    const progressPercent =
        progress && progress.duration > 0 && isFinite(progress.duration)
            ? (progress.currentTime / progress.duration) * 100
            : 0;

    // 订阅应用状态
    useEffect(() => {
        appSyncAuxiliary.subscribeAppState([
            'musicItem',
            'playerState',
            'repeatMode',
            'progress',
            'isFavorite',
        ]);
    }, []);

    // ─── 事件处理 ───

    const handleShowMainWindow = useCallback(() => {
        systemUtil.exitMinimode();
    }, []);

    const handlePlayPause = useCallback(() => {
        appSyncAuxiliary.sendCommand('play/pause');
    }, []);

    const handleSkipPrev = useCallback(() => {
        appSyncAuxiliary.sendCommand('skip-previous');
    }, []);

    const handleSkipNext = useCallback(() => {
        appSyncAuxiliary.sendCommand('skip-next');
    }, []);

    const handleToggleFavorite = useCallback(() => {
        appSyncAuxiliary.sendCommand('like/dislike');
    }, []);

    const handleToggleDesktopLyric = useCallback(() => {
        const current = appConfig.getConfigByKey('lyric.enableDesktopLyric');
        appConfig.setConfig({
            'lyric.enableDesktopLyric': !current,
        });
    }, []);

    const handleToggleRepeatMode = useCallback(() => {
        appSyncAuxiliary.sendCommand('set-repeat-mode', nextRepeatMode);
    }, [nextRepeatMode]);

    return (
        <div className="l-minimode">
            {/* ── 封面（点击回到主窗口） ── */}
            <button
                type="button"
                className="l-minimode__artwork"
                title={t('playback.expand_main_window')}
                onClick={handleShowMainWindow}
            >
                <img
                    className="l-minimode__artwork-img"
                    src={musicItem?.artwork || albumImg}
                    alt=""
                    draggable={false}
                    onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (!img.src.endsWith(albumImg)) {
                            img.src = albumImg;
                        }
                    }}
                />
                <span className="l-minimode__artwork-overlay">
                    <Maximize2 size={20} />
                </span>
            </button>

            {/* ── 歌曲信息 + 进度条 ── */}
            <div className="l-minimode__info">
                <div className="l-minimode__title">
                    {musicItem?.title || (!musicItem ? t('playback.not_playing') : '')}
                </div>
                <div className="l-minimode__subtitle">
                    {[musicItem?.artist, musicItem?.album].filter(Boolean).join(' · ')}
                </div>
                <div className="l-minimode__progress">
                    <div
                        className="l-minimode__progress-fill"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* ── 控制区域 ── */}
            <div className="l-minimode__controls">
                {/* 播放控制 */}
                <div className="l-minimode__playback">
                    <button type="button" className="l-minimode__ctrl-btn" onClick={handleSkipPrev}>
                        <SkipBack size={16} fill="currentColor" />
                    </button>
                    <button
                        type="button"
                        className="l-minimode__ctrl-btn l-minimode__ctrl-btn--play"
                        onClick={handlePlayPause}
                    >
                        {isPlaying ? (
                            <Pause size={16} fill="currentColor" />
                        ) : (
                            <Play size={16} fill="currentColor" style={{ marginLeft: 1 }} />
                        )}
                    </button>
                    <button type="button" className="l-minimode__ctrl-btn" onClick={handleSkipNext}>
                        <SkipForward size={16} fill="currentColor" />
                    </button>
                </div>

                {/* 工具按钮 */}
                <div className="l-minimode__utility">
                    <button
                        type="button"
                        className={`l-minimode__util-btn${isFavorite ? ' is-favorite' : ''}`}
                        onClick={handleToggleFavorite}
                    >
                        <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                        type="button"
                        className={`l-minimode__util-btn${enableDesktopLyric ? ' is-active' : ''}`}
                        onClick={handleToggleDesktopLyric}
                    >
                        <DesktopLyric size={14} />
                    </button>
                    <button
                        type="button"
                        className="l-minimode__util-btn"
                        onClick={handleToggleRepeatMode}
                    >
                        <RepeatIcon size={14} />
                    </button>
                    <button
                        type="button"
                        className="l-minimode__util-btn"
                        title={t('playback.expand_main_window')}
                        onClick={handleShowMainWindow}
                    >
                        <Maximize2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
