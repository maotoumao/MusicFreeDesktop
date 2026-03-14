// ============================================================================
// LyricPanel — 歌词滚动面板
// ============================================================================
//
// 独立订阅 currentLyricAtom，隔离高频更新，避免整个 FullscreenPlayer 重渲染。
// 高亮行变化时通过手动 scrollTo（非 scrollIntoView）滚动到对应位置。

import { useRef, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLyric } from '@renderer/mainWindow/core/trackPlayer/hooks';
import type { IParsedLrcItem } from '@common/lyricParser';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';

interface LyricPanelProps {
    /** 字号缩放比例 (0.8 ~ 1.3) */
    fontScale: number;
    /** 是否显示翻译 */
    showTranslation: boolean;
}

/** 活跃行基准字号 (px) — 对标设计稿 32px */
const ACTIVE_BASE_SIZE = 32;
/** 非活跃行基准字号 (px) — 对标设计稿 22px */
const INACTIVE_BASE_SIZE = 22;

/** 拖拽判定阈值 (px)，移动距离超过此值视为拖拽而非点击 */
const DRAG_THRESHOLD = 5;
/** 用户拖拽后暂停自动滚动的时长 (ms) */
const USER_SCROLL_PAUSE = 4000;

/** 检测用户是否偏好减少动画 */
const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const LyricPanel = memo(function LyricPanel({ fontScale, showTranslation }: LyricPanelProps) {
    const { t } = useTranslation();
    const lyricState = useLyric();
    const containerRef = useRef<HTMLDivElement>(null);
    const activeIndexRef = useRef<number>(-1);
    const isInitialRef = useRef(true);

    // 拖拽滚动状态
    const dragState = useRef({
        isDragging: false,
        startY: 0,
        startScrollTop: 0,
        hasMoved: false,
    });

    // 拖拽完成标记，供 click 事件判断（click 在 pointerup 之后触发）
    const wasDraggedRef = useRef(false);

    // 用户交互暂停自动滚动
    const userScrollPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isUserScrolling = useRef(false);

    const parser = lyricState?.parser;
    const currentLrc = lyricState?.currentLrc;
    const lyricItems = parser?.getLyricItems() ?? [];
    const activeIndex = currentLrc?.index ?? -1;

    /** 标记用户正在手动滚动，暂停自动跟随 */
    const pauseAutoScroll = useCallback(() => {
        isUserScrolling.current = true;
        if (userScrollPauseTimer.current) {
            clearTimeout(userScrollPauseTimer.current);
        }
        userScrollPauseTimer.current = setTimeout(() => {
            isUserScrolling.current = false;
        }, USER_SCROLL_PAUSE);
    }, []);

    // 当高亮行变化时滚动到对应位置（用户拖拽期间暂停）
    useEffect(() => {
        if (activeIndex === activeIndexRef.current) return;
        activeIndexRef.current = activeIndex;

        if (isUserScrolling.current) return;

        const container = containerRef.current;
        if (!container || activeIndex < 0) return;

        const activeEl = container.querySelector<HTMLElement>(
            `[data-lyric-index="${activeIndex}"]`,
        );
        if (!activeEl) return;

        const isInitial = isInitialRef.current;
        if (isInitial) isInitialRef.current = false;

        const scrollTop =
            activeEl.offsetTop - container.offsetHeight / 2 + activeEl.offsetHeight / 2;
        container.scrollTo({
            top: scrollTop,
            behavior: isInitial || prefersReducedMotion ? 'auto' : 'smooth',
        });
    }, [activeIndex]);

    /** 拖拽开始 */
    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;

        dragState.current = {
            isDragging: true,
            startY: e.clientY,
            startScrollTop: container.scrollTop,
            hasMoved: false,
        };

        wasDraggedRef.current = false;

        container.classList.add('is-dragging');
        container.setPointerCapture(e.pointerId);
    }, []);

    /** 拖拽移动 */
    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const state = dragState.current;
        if (!state.isDragging) return;

        const container = containerRef.current;
        if (!container) return;

        const deltaY = e.clientY - state.startY;

        if (!state.hasMoved && Math.abs(deltaY) > DRAG_THRESHOLD) {
            state.hasMoved = true;
        }

        if (state.hasMoved) {
            container.scrollTop = state.startScrollTop - deltaY;
        }
    }, []);

    /** 拖拽结束 */
    const handlePointerUp = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const state = dragState.current;
            const container = containerRef.current;

            if (container) {
                container.classList.remove('is-dragging');
                container.releasePointerCapture(e.pointerId);
            }

            wasDraggedRef.current = state.hasMoved;

            if (state.hasMoved) {
                pauseAutoScroll();
            }

            dragState.current = {
                isDragging: false,
                startY: 0,
                startScrollTop: 0,
                hasMoved: false,
            };
        },
        [pauseAutoScroll],
    );

    /** 点击歌词行跳转播放位置（拖拽时不触发） */
    const handleLyricClick = useCallback((item: IParsedLrcItem) => {
        if (wasDraggedRef.current) return;
        trackPlayer.seekTo(item.time);
    }, []);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (userScrollPauseTimer.current) {
                clearTimeout(userScrollPauseTimer.current);
            }
        };
    }, []);

    if (lyricItems.length === 0) {
        return (
            <div className="l-fullscreen-player__lyric-empty">
                <span
                    className="l-fullscreen-player__lyric-empty-text"
                    style={{ fontSize: `${INACTIVE_BASE_SIZE * fontScale}px` }}
                >
                    {t('lyric.no_lyric')}
                </span>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="l-fullscreen-player__lyric-scroll"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {lyricItems.map((item) => {
                const isActive = item.index === activeIndex;

                return (
                    <div
                        key={item.index}
                        data-lyric-index={item.index}
                        className={
                            isActive
                                ? 'l-fullscreen-player__lyric-line is-active'
                                : 'l-fullscreen-player__lyric-line'
                        }
                        style={{
                            fontSize: isActive
                                ? `${ACTIVE_BASE_SIZE * fontScale}px`
                                : `${INACTIVE_BASE_SIZE * fontScale}px`,
                        }}
                        onClick={() => handleLyricClick(item)}
                    >
                        <div className="l-fullscreen-player__lyric-text">{item.lrc}</div>
                        {showTranslation && item.translation && (
                            <div className="l-fullscreen-player__lyric-trans">
                                {item.translation}
                            </div>
                        )}
                    </div>
                );
            })}
            {/* 底部留白，确保最后一行能滚动到容器中心 */}
            <div className="l-fullscreen-player__lyric-spacer" />
        </div>
    );
});

export default LyricPanel;
