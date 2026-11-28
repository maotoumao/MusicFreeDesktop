// ============================================================================
// Marquee — 原子组件
// ============================================================================

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type HTMLAttributes,
    type ReactNode,
} from 'react';
import { cn } from '@common/cn';
import './index.scss';

export interface MarqueeProps extends HTMLAttributes<HTMLDivElement> {
    /** 内容（可以是任意 ReactNode，非纯文本亦可） */
    children: ReactNode;
    /** 滚动速度，单位 px/s @default 35 */
    speed?: number;
    /** 两份内容之间的间距，单位 px @default 60 */
    gap?: number;
}

/**
 * Marquee — 原子组件
 *
 * 溢出时自动水平滚动的容器，支持任意子内容（文字、图标、徽章混排等）。
 * 内容不溢出时保持静止；溢出后循环滚动，hover 暂停。
 *
 * 设计稿还原（像素级）：
 *   容器: overflow hidden, min-w-0
 *   内容: flex items-center, whitespace nowrap
 *   滚动: 线性匀速循环, hover 暂停
 *   速度: 32px/s, gap 60px（默认值）
 */
export function Marquee({ children, speed = 32, gap = 60, className, ...rest }: MarqueeProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLSpanElement>(null);
    const [shouldScroll, setShouldScroll] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [contentWidth, setContentWidth] = useState(0);

    const checkOverflow = useCallback(() => {
        if (!containerRef.current || !contentRef.current) return;
        const containerW = containerRef.current.offsetWidth;
        const contentW = contentRef.current.offsetWidth;
        setShouldScroll(contentW > containerW);
        setContentWidth(contentW);
    }, []);

    useEffect(() => {
        checkOverflow();
        const observer = new ResizeObserver(checkOverflow);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [checkOverflow, children]);

    const totalWidth = contentWidth + gap;
    const duration = totalWidth / speed;

    return (
        <div
            ref={containerRef}
            className={cn('marquee', className)}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            {...rest}
        >
            <div
                className="marquee__track"
                style={
                    shouldScroll
                        ? ({
                              animation: `marquee-scroll ${duration}s linear infinite ${isPaused ? 'paused' : 'running'}`,
                              width: 'max-content',
                              '--marquee-offset': `-${totalWidth}px`,
                          } as React.CSSProperties)
                        : undefined
                }
            >
                <span ref={contentRef} className="marquee__content">
                    {children}
                </span>
                {shouldScroll && (
                    <>
                        <span className="marquee__gap" style={{ width: gap }} />
                        <span className="marquee__content">{children}</span>
                    </>
                )}
            </div>
        </div>
    );
}

export default Marquee;
