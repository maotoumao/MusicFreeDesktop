// ============================================================================
// VolumePopover — 音量垂直气泡面板
// ============================================================================
//
// hover 音量按钮时弹出垂直滑条，支持拖拽、点击定位和鼠标滚轮调节。
// 背景纯色 (--color-bg-modal)，不使用 backdrop-filter。

import { useCallback, useRef, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { useVolume } from '@renderer/mainWindow/core/trackPlayer/hooks';

/** 根据音量值选择图标 */
function getVolumeIcon(volume: number) {
    if (volume === 0) return VolumeX;
    if (volume < 0.4) return Volume1;
    return Volume2;
}

/** 每次滚轮步进 */
const WHEEL_STEP = 0.02;

/**
 * VolumePopover
 *
 * 音量按钮 + 垂直气泡面板。
 * - hover 延迟 120ms 打开 / 200ms 关闭
 * - 垂直滑条：4px × 100px，pointer-capture 拖拽
 * - 鼠标滚轮：整个区域监听 wheel 事件，±2%
 */
const VolumePopover = memo(function VolumePopover() {
    const { t } = useTranslation();
    const volume = useVolume();
    const VolumeIcon = getVolumeIcon(volume);

    const anchorRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const prevVolumeRef = useRef(1);
    /** 供原生 wheel listener 读取最新值，避免闭包过时 */
    const volumeRef = useRef(volume);
    volumeRef.current = volume;

    // ── 显示/隐藏逻辑 ──

    const show = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            popoverRef.current?.classList.add('is-visible');
        }, 120);
    }, []);

    const hide = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            popoverRef.current?.classList.remove('is-visible');
        }, 200);
    }, []);

    // ── 垂直滑条拖拽 ──

    const setVolumeFromPointer = useCallback((clientY: number) => {
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        // 底部 = 0，顶部 = 1
        const pct = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
        trackPlayer.setVolume(pct);
    }, []);

    const handlePointerDown = useCallback(
        (e: React.PointerEvent) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            isDraggingRef.current = true;
            setVolumeFromPointer(e.clientY);
        },
        [setVolumeFromPointer],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!isDraggingRef.current) return;
            setVolumeFromPointer(e.clientY);
        },
        [setVolumeFromPointer],
    );

    const handlePointerUp = useCallback(() => {
        isDraggingRef.current = false;
    }, []);

    // ── 滚轮调节（原生事件：React onWheel 是 passive，无法 preventDefault） ──

    useEffect(() => {
        const el = anchorRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP;
            trackPlayer.setVolume(Math.max(0, Math.min(1, volumeRef.current + delta)));
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const volumePct = Math.round(volume * 100);

    return (
        <div
            ref={anchorRef}
            className="l-player-bar__popover-anchor"
            onMouseEnter={show}
            onMouseLeave={hide}
        >
            {/* 触发按钮 */}
            <button
                className="l-player-bar__ctrl-btn"
                type="button"
                title={volume === 0 ? t('playback.unmute') : t('playback.mute')}
                onClick={() => {
                    if (volume === 0) {
                        trackPlayer.setVolume(prevVolumeRef.current || 1);
                    } else {
                        prevVolumeRef.current = volume;
                        trackPlayer.setVolume(0);
                    }
                }}
            >
                <VolumeIcon size={15} />
            </button>

            {/* 气泡面板 */}
            <div ref={popoverRef} className="l-player-bar__popover">
                <span className="l-player-bar__popover-value">{volumePct}</span>
                <div
                    ref={trackRef}
                    className="l-player-bar__popover-track"
                    role="slider"
                    aria-label={t('playback.volume')}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={volumePct}
                    tabIndex={0}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onLostPointerCapture={handlePointerUp}
                >
                    <div
                        className="l-player-bar__popover-fill"
                        style={{ height: `${volumePct}%` }}
                    />
                    <div
                        className="l-player-bar__popover-thumb"
                        style={{ bottom: `${volumePct}%` }}
                    />
                </div>
            </div>
        </div>
    );
});

export default VolumePopover;
