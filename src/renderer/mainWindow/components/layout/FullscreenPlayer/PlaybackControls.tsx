// ============================================================================
// PlaybackControls — 全屏播放器控制面板
// ============================================================================
//
// 封面下方的播放控制区域，从上到下两行：
//   1. 播控行：❤️ (左) / 上一首·播放暂停·下一首 (中) / 播放模式 (右)
//   2. 进度行：当前时间 / 进度条(slim) / 总时长
//
// FullscreenProgressBar 独立 memo 子组件，隔离 useProgress 高频更新。

import { memo } from 'react';
import { SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { PlayerState } from '@common/constant';
import formatDuration from '@common/formatDuration';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { useTranslation } from 'react-i18next';
import { FavoriteButton } from '../../business/FavoriteButton';
import {
    useCurrentMusic,
    usePlayerState,
    useRepeatMode,
    useProgress,
} from '@renderer/mainWindow/core/trackPlayer/hooks';
import { REPEAT_MODE_MAP } from '@renderer/common/repeatModeMap';
import { ProgressBar } from '../../ui/ProgressBar';
import { useProgressDrag } from '@renderer/mainWindow/hooks/useProgressDrag';

// ─── FullscreenProgressBar — 隔离高频 progressAtom 更新 ───

const FullscreenProgressBar = memo(function FullscreenProgressBar() {
    const progress = useProgress();
    const { displayValue, displayTime, handleChange, handleDragStart, handleDragEnd } =
        useProgressDrag(progress);

    return (
        <div className="l-fullscreen-player__progress">
            <span className="l-fullscreen-player__time">{formatDuration(displayTime)}</span>
            <ProgressBar
                value={displayValue}
                variant="slim"
                interactive
                onChange={handleChange}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            />
            <span className="l-fullscreen-player__time">{formatDuration(progress.duration)}</span>
        </div>
    );
});

// ─── PlaybackControls ───

/**
 * PlaybackControls — 布局子组件
 *
 * 全屏播放器封面下方控制面板。
 * 播控行（❤️ · 播控 · 播放模式）→ 进度条行，两行垂直排列。
 */
const PlaybackControls = memo(function PlaybackControls() {
    const { t } = useTranslation();
    const currentMusic = useCurrentMusic();
    const playerState = usePlayerState();
    const repeatMode = useRepeatMode();

    const isPlaying = playerState === PlayerState.Playing;
    const hasMusic = currentMusic != null;

    const { Icon: RepeatIcon, tipKey: repeatTipKey } = REPEAT_MODE_MAP[repeatMode];

    return (
        <div className="l-fullscreen-player__controls">
            {/* 播控行：❤️ / ◁◁ / ▶ / ▷▷ / 🔁 */}
            <div className="l-fullscreen-player__playback">
                {hasMusic && <FavoriteButton musicItem={currentMusic} size="md" />}
                <button
                    className="l-fullscreen-player__ctrl-btn"
                    type="button"
                    title={t('playback.previous')}
                    aria-label={t('playback.previous')}
                    onClick={() => trackPlayer.skipToPrev()}
                >
                    <SkipBack size={22} fill="currentColor" />
                </button>
                <button
                    className="l-fullscreen-player__ctrl-btn l-fullscreen-player__ctrl-btn--play"
                    type="button"
                    title={isPlaying ? t('playback.pause') : t('playback.play')}
                    aria-label={isPlaying ? t('playback.pause') : t('playback.play')}
                    onClick={() => trackPlayer.togglePlayPause()}
                >
                    {isPlaying ? (
                        <Pause size={28} fill="currentColor" />
                    ) : (
                        // 播放三角形视觉居中补偿 2px
                        <Play size={28} fill="currentColor" style={{ marginLeft: 2 }} />
                    )}
                </button>
                <button
                    className="l-fullscreen-player__ctrl-btn"
                    type="button"
                    title={t('playback.next')}
                    aria-label={t('playback.next')}
                    onClick={() => trackPlayer.skipToNext()}
                >
                    <SkipForward size={22} fill="currentColor" />
                </button>
                <button
                    className="l-fullscreen-player__ctrl-btn"
                    type="button"
                    title={t(repeatTipKey)}
                    aria-label={t(repeatTipKey)}
                    onClick={() => trackPlayer.toggleRepeatMode()}
                >
                    <RepeatIcon size={18} />
                </button>
            </div>

            {/* 进度条行 */}
            <FullscreenProgressBar />
        </div>
    );
});

export default PlaybackControls;
