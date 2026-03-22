// ============================================================================
// LyricToolbar — 歌词窗口操控栏
// ============================================================================

import {
    SkipBack,
    SkipForward,
    Play,
    Pause,
    Lock,
    LockOpen,
    X,
    Pin,
    PinOff,
    AArrowUp,
    AArrowDown,
} from 'lucide-react';
import { cn } from '@common/cn';
import { PlayerState } from '@common/constant';
import appSyncAuxiliary, { useAppStatePartial } from '@infra/appSync/renderer/auxiliary';
import appConfig from '@infra/appConfig/renderer';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import systemUtil from '@infra/systemUtil/renderer';

import './index.scss';

interface LyricToolbarProps {
    locked: boolean;
    visible: boolean;
}

export default function LyricToolbar({ locked, visible }: LyricToolbarProps) {
    if (locked) {
        return <LockedToolbar visible={visible} />;
    }
    return <UnlockedToolbar visible={visible} />;
}

/** 锁定态：仅显示解锁按钮 */
function LockedToolbar({ visible }: { visible: boolean }) {
    return (
        <div className={cn('lyric-toolbar', visible && 'is-visible')}>
            <button
                className="lyric-toolbar__btn lyric-toolbar__btn--unlock"
                type="button"
                onMouseOver={() => {
                    systemUtil.ignoreMouseEvent(false);
                }}
                onMouseLeave={() => {
                    systemUtil.ignoreMouseEvent(true);
                }}
                onClick={() => {
                    appConfig.setConfig({ 'lyric.lockLyric': false });
                }}
            >
                <LockOpen size={16} />
            </button>
        </div>
    );
}

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 80;
const FONT_SIZE_STEP = 2;

/** 解锁态：完整播放控制 + 置顶/字号 + 锁定 + 关闭 */
function UnlockedToolbar({ visible }: { visible: boolean }) {
    const playerState = useAppStatePartial('playerState');
    const isPlaying = playerState === PlayerState.Playing;

    const [alwaysOnTop] = useConfigValue('lyric.alwaysOnTop');
    const isOnTop = alwaysOnTop ?? true;

    const [fontSize] = useConfigValue('lyric.fontSize');
    const currentSize = fontSize ?? 54;

    return (
        <div className={cn('lyric-toolbar', visible && 'is-visible')}>
            {/* ── 置顶 ── */}
            <button
                className={cn('lyric-toolbar__btn', isOnTop && 'is-active')}
                type="button"
                onClick={() => {
                    appConfig.setConfig({ 'lyric.alwaysOnTop': !isOnTop });
                }}
            >
                {isOnTop ? <Pin size={16} fill="currentColor" /> : <PinOff size={16} />}
            </button>

            <span className="lyric-toolbar__sep" />

            {/* ── 字号调整 ── */}
            <button
                className="lyric-toolbar__btn"
                type="button"
                disabled={currentSize <= FONT_SIZE_MIN}
                onClick={() => {
                    const next = Math.max(FONT_SIZE_MIN, currentSize - FONT_SIZE_STEP);
                    appConfig.setConfig({ 'lyric.fontSize': next });
                }}
            >
                <AArrowDown size={16} />
            </button>
            <button
                className="lyric-toolbar__btn"
                type="button"
                disabled={currentSize >= FONT_SIZE_MAX}
                onClick={() => {
                    const next = Math.min(FONT_SIZE_MAX, currentSize + FONT_SIZE_STEP);
                    appConfig.setConfig({ 'lyric.fontSize': next });
                }}
            >
                <AArrowUp size={16} />
            </button>

            <span className="lyric-toolbar__sep" />

            {/* ── 播放控制 ── */}
            <button
                className="lyric-toolbar__btn"
                type="button"
                onClick={() => {
                    appSyncAuxiliary.sendCommand('skip-previous');
                }}
            >
                <SkipBack size={16} fill="currentColor" />
            </button>
            <button
                className="lyric-toolbar__btn"
                type="button"
                onClick={() => {
                    appSyncAuxiliary.sendCommand('play/pause');
                }}
            >
                {isPlaying ? (
                    <Pause size={16} fill="currentColor" />
                ) : (
                    <Play size={16} fill="currentColor" />
                )}
            </button>
            <button
                className="lyric-toolbar__btn"
                type="button"
                onClick={() => {
                    appSyncAuxiliary.sendCommand('skip-next');
                }}
            >
                <SkipForward size={16} fill="currentColor" />
            </button>

            <span className="lyric-toolbar__sep" />

            {/* ── 锁定 & 关闭 ── */}
            <button
                className="lyric-toolbar__btn"
                type="button"
                onClick={() => {
                    appConfig.setConfig({ 'lyric.lockLyric': true });
                }}
            >
                <Lock size={16} />
            </button>
            <button
                className="lyric-toolbar__btn"
                type="button"
                onClick={() => {
                    appConfig.setConfig({ 'lyric.enableDesktopLyric': false });
                }}
            >
                <X size={16} />
            </button>
        </div>
    );
}
