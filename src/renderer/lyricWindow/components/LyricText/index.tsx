// ============================================================================
// LyricText — 歌词文字渲染
// ============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@common/cn';
import appSyncAuxiliary, { useAppStatePartial } from '@infra/appSync/renderer/auxiliary';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import type { IAppState } from '@appTypes/infra/appSync';

import './index.scss';

// ── 滚动平滑过渡时长（ms） ──
const SCROLL_TRANSITION_MS = 900;

export default memo(function LyricText() {
    const { t } = useTranslation();
    const currentMusic = useAppStatePartial('musicItem');
    const currentLrc = useAppStatePartial('currentLrc');

    const [fontData] = useConfigValue('lyric.fontData');
    const [fontSize] = useConfigValue('lyric.fontSize');
    const [fontColor] = useConfigValue('lyric.fontColor');
    const [strokeColor] = useConfigValue('lyric.strokeColor');

    const fontFamily = fontData?.family || undefined;
    const resolvedFontSize = fontSize ?? 54;

    // musicItem 同步前为 undefined，同步后为 IMusicItemSlim | null，
    // 因此 undefined 可靠地表示“状态尚未从主窗口同步”
    const isStateReady = currentMusic !== undefined;

    // 歌词文本：状态未就绪前显示空白，避免闪烁 "no_lyric"
    const displayText = !isStateReady
        ? ''
        : (currentLrc?.lrc ??
          (currentMusic
              ? `${currentMusic.title} - ${currentMusic.artist ?? ''}`
              : t('lyric.no_lyric')));

    // ── DOM 测量：用实际渲染宽度判断是否需要滚动 ──
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const [textWidth, setTextWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    const measureWidths = useCallback(() => {
        const content = contentRef.current;
        const container = containerRef.current;
        if (!content || !container) return;
        setTextWidth(content.scrollWidth);
        setContainerWidth(container.clientWidth);
    }, []);

    // 容器尺寸变化时重新测量
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const ro = new ResizeObserver(measureWidths);
        ro.observe(container);
        measureWidths();

        return () => ro.disconnect();
    }, [measureWidths]);

    // 文本或字体变化时重新测量
    useLayoutEffect(measureWidths, [displayText, resolvedFontSize, fontFamily, measureWidths]);

    // 滚动状态
    const [left, setLeft] = useState<number | null>(null);
    const [enableTransition, setEnableTransition] = useState(false);

    // 歌词切换时重置滚动位置
    useLayoutEffect(() => {
        if (textWidth > containerWidth) {
            console.log(textWidth, containerWidth);
            setEnableTransition(false);
            setLeft(0);
        } else {
            setLeft(null);
        }
    }, [textWidth, containerWidth]);

    // 监听 progress 变化实现平滑滚动
    const currentLrcRef = useRef(currentLrc);
    currentLrcRef.current = currentLrc;

    useEffect(() => {
        if (textWidth <= containerWidth) return;

        const handler = (_state: Partial<IAppState>, changed: Partial<IAppState>) => {
            if (!changed.progress) return;
            const lrc = currentLrcRef.current;
            if (!lrc || lrc.index < 0) return;

            const progress = changed.progress.currentTime;
            // TODO: IAppState 尚未同步 fullLyric，无法获取下一行歌词时间，
            //       暂用固定 5s 估算。待 IAppState 扩展后替换为实际差值。
            const estimatedDuration = 5;
            const virtualPointer = ((progress - lrc.time) / estimatedDuration) * textWidth;

            if (virtualPointer > containerWidth * 0.5) {
                setEnableTransition(true);
                setLeft(
                    -Math.min(
                        (virtualPointer - containerWidth * 0.5) * 1.1,
                        textWidth - containerWidth,
                    ),
                );
            } else {
                setEnableTransition(false);
                setLeft(0);
            }
        };

        const dispose = appSyncAuxiliary.onStateChange(handler);
        return dispose;
    }, [textWidth, containerWidth]);

    // 缓存 style 对象避免每次渲染重建
    const contentStyle = useMemo(
        () => ({
            color: fontColor ?? '#ffffff',
            WebkitTextStrokeColor: strokeColor ?? '#f5c542',
            fontSize: resolvedFontSize,
            fontFamily,
            left: left ?? undefined,
            transition: enableTransition ? `left ${SCROLL_TRANSITION_MS}ms linear` : 'none',
            position: (left != null ? 'relative' : undefined) as 'relative' | undefined,
        }),
        [fontColor, strokeColor, resolvedFontSize, fontFamily, left, enableTransition],
    );

    const needsScroll = textWidth > containerWidth;

    return (
        <div ref={containerRef} className={cn('lyric-text', needsScroll && 'is-scrollable')}>
            <div ref={contentRef} className="lyric-text__content" style={contentStyle}>
                {displayText}
            </div>
        </div>
    );
});
