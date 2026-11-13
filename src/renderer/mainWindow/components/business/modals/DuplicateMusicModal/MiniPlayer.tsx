/**
 * DuplicateMusicModal — 弹窗内独立试听播放条
 *
 * 只展示 usePreviewPlayer 的试听状态，不订阅主播放器，因此不会出现
 * 外部歌单的歌曲。没有试听会话时返回 null 并隐藏。
 */
import { memo, useState } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import formatDuration from '@common/formatDuration';
import { Artwork } from '@renderer/mainWindow/components/ui/Artwork';
import { ProgressBar } from '@renderer/mainWindow/components/ui/ProgressBar';
import type { PreviewPlayerState } from './usePreviewPlayer';

export interface DuplicateMiniPlayerProps {
    state: PreviewPlayerState;
    onToggle: () => void;
    onNext: () => void;
    /** ratio 0–1 */
    onSeek: (ratio: number) => void;
}

const MiniProgress = memo(function MiniProgress({
    state,
    onSeek,
}: Pick<DuplicateMiniPlayerProps, 'state' | 'onSeek'>) {
    const [dragValue, setDragValue] = useState<number | null>(null);
    const percent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
    const displayValue = dragValue ?? percent;
    const displayTime = dragValue != null ? (dragValue / 100) * state.duration : state.currentTime;

    return (
        <div className="duplicate-music-modal__mini-progress-row">
            <ProgressBar
                className="duplicate-music-modal__mini-progress"
                value={displayValue}
                variant="slim"
                interactive={state.duration > 0}
                onChange={setDragValue}
                onDragStart={() => setDragValue(percent)}
                onDragEnd={(value) => {
                    onSeek(value / 100);
                    setDragValue(null);
                }}
            />
            <span className="duplicate-music-modal__mini-time">
                {formatDuration(displayTime)} / {formatDuration(state.duration)}
            </span>
        </div>
    );
});

export default function DuplicateMiniPlayer({
    state,
    onToggle,
    onNext,
    onSeek,
}: DuplicateMiniPlayerProps) {
    const { t } = useTranslation();

    if (!state.current) return null;

    const statusLabel = state.error
        ? t('local_music.duplicate_preview_failed')
        : state.playing
          ? t('local_music.duplicate_previewing')
          : t('local_music.duplicate_preview_paused');

    return (
        <div className="duplicate-music-modal__mini-player">
            <Artwork
                alt={state.current.title}
                size="sm"
                rounded="sm"
                className="duplicate-music-modal__mini-cover"
            />
            <div className="duplicate-music-modal__mini-body">
                <div className="duplicate-music-modal__mini-title-row">
                    <span className="duplicate-music-modal__mini-title">{state.current.title}</span>
                    {state.current.artist && (
                        <span className="duplicate-music-modal__mini-artist">
                            {state.current.artist}
                        </span>
                    )}
                    <span
                        className={`duplicate-music-modal__mini-tag${state.error ? ' is-error' : ''}`}
                    >
                        {statusLabel}
                    </span>
                </div>
                <MiniProgress state={state} onSeek={onSeek} />
            </div>
            <div className="duplicate-music-modal__mini-controls">
                <button
                    type="button"
                    className="duplicate-music-modal__mini-ctrl"
                    title={state.playing ? t('playback.pause') : t('playback.play')}
                    onClick={onToggle}
                >
                    {state.playing ? (
                        <Pause size={16} fill="currentColor" />
                    ) : (
                        <Play size={16} fill="currentColor" />
                    )}
                </button>
                <button
                    type="button"
                    className="duplicate-music-modal__mini-ctrl"
                    title={t('playback.next')}
                    disabled={!state.hasNext}
                    onClick={onNext}
                >
                    <SkipForward size={16} fill="currentColor" />
                </button>
            </div>
            {state.error && (
                <div className="duplicate-music-modal__mini-warn">
                    {t('local_music.duplicate_preview_error')}
                </div>
            )}
        </div>
    );
}
