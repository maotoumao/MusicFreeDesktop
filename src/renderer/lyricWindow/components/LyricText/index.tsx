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

// ── 翻译行字号相对主句的比例（主句与翻译行合计不超过歌词窗口的文字区高度） ──
const TRANSLATION_FONT_SCALE = 0.6;

// ── 双行模式每行字号相对设置字号的比例（两行合计不超过歌词窗口的文字区高度） ──
const DOUBLE_LINE_FONT_SCALE = 0.8;

// ── 滚动平滑过渡时长（ms） ──
const SCROLL_TRANSITION_MS = 900;

// ── 没有下一句时（最后一句）用于估算滚动速度的时长（s） ──
const FALLBACK_LINE_DURATION = 5;

export default memo(function LyricText() {
    const [doubleLine] = useConfigValue('lyric.doubleLine');
    return doubleLine ? <DoubleLineLyric /> : <SingleLineLyric />;
});

/** 单行：当前句过长时随播放进度横向滚动，可在下方显示翻译 */
function SingleLineLyric() {
    const { t } = useTranslation();
    const currentMusic = useAppStatePartial('musicItem');
    const currentLrc = useAppStatePartial('currentLrc');
    const nextLrc = useAppStatePartial('nextLrc');

    const [fontData] = useConfigValue('lyric.fontData');
    const [fontSize] = useConfigValue('lyric.fontSize');
    const [fontColor] = useConfigValue('lyric.fontColor');
    const [strokeColor] = useConfigValue('lyric.strokeColor');
    const [showTranslation] = useConfigValue('lyric.showTranslation');

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
            setEnableTransition(false);
            setLeft(0);
        } else {
            setLeft(null);
        }
    }, [textWidth, containerWidth]);

    // 监听 progress 变化实现平滑滚动
    const currentLrcRef = useRef(currentLrc);
    currentLrcRef.current = currentLrc;
    const nextLrcRef = useRef(nextLrc);
    nextLrcRef.current = nextLrc;

    useEffect(() => {
        if (textWidth <= containerWidth) return;

        const handler = (_state: Partial<IAppState>, changed: Partial<IAppState>) => {
            if (!changed.progress) return;
            const lrc = currentLrcRef.current;
            if (!lrc || lrc.index < 0) return;

            const progress = changed.progress.currentTime;
            const next = nextLrcRef.current;
            const lineDuration =
                next && next.time > lrc.time ? next.time - lrc.time : FALLBACK_LINE_DURATION;
            const virtualPointer = ((progress - lrc.time) / lineDuration) * textWidth;

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
    const translation = (showTranslation ?? true) ? currentLrc?.translation : undefined;

    const translationStyle = useMemo(
        () => ({
            color: fontColor ?? '#ffffff',
            WebkitTextStrokeColor: strokeColor ?? '#f5c542',
            fontSize: Math.round(resolvedFontSize * TRANSLATION_FONT_SCALE),
            fontFamily,
        }),
        [fontColor, strokeColor, resolvedFontSize, fontFamily],
    );

    return (
        <div ref={containerRef} className={cn('lyric-text', needsScroll && 'is-scrollable')}>
            <div ref={contentRef} className="lyric-text__content" style={contentStyle}>
                {displayText}
            </div>
            {translation && (
                <div className="lyric-text__translation" style={translationStyle}>
                    {translation}
                </div>
            )}
        </div>
    );
}

/**
 * 双行：当前句与下一句交替占据上行（左对齐）和下行（右对齐），
 * 当前句为偶数句时在上行，下一句在下行；过长时省略，不显示翻译。
 */
function DoubleLineLyric() {
    const { t } = useTranslation();
    const currentMusic = useAppStatePartial('musicItem');
    const currentLrc = useAppStatePartial('currentLrc');
    const nextLrc = useAppStatePartial('nextLrc');

    const [fontData] = useConfigValue('lyric.fontData');
    const [fontSize] = useConfigValue('lyric.fontSize');
    const [fontColor] = useConfigValue('lyric.fontColor');
    const [strokeColor] = useConfigValue('lyric.strokeColor');

    const lineStyle = useMemo(
        () => ({
            color: fontColor ?? '#ffffff',
            WebkitTextStrokeColor: strokeColor ?? '#f5c542',
            fontSize: Math.round((fontSize ?? 54) * DOUBLE_LINE_FONT_SCALE),
            fontFamily: fontData?.family || undefined,
        }),
        [fontColor, strokeColor, fontSize, fontData],
    );

    const isStateReady = currentMusic !== undefined;
    const currentText = !isStateReady
        ? ''
        : (currentLrc?.lrc ??
          (currentMusic
              ? `${currentMusic.title} - ${currentMusic.artist ?? ''}`
              : t('lyric.no_lyric')));
    const nextText = nextLrc?.lrc ?? '';
    const currentOnTop = (currentLrc?.index ?? 0) % 2 === 0;

    return (
        <div className="lyric-text lyric-text--double">
            <div className={cn('lyric-text__line', currentOnTop && 'is-current')} style={lineStyle}>
                {currentOnTop ? currentText : nextText}
            </div>
            <div
                className={cn(
                    'lyric-text__line',
                    'lyric-text__line--end',
                    !currentOnTop && 'is-current',
                )}
                style={lineStyle}
            >
                {currentOnTop ? nextText : currentText}
            </div>
        </div>
    );
}
