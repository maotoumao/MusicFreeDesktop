import { forwardRef, useCallback, useRef, type HTMLAttributes, type MouseEvent } from 'react';
import { cn } from '@common/cn';
import './index.scss';

export type ProgressBarVariant = 'slim' | 'thick' | 'labeled';

export interface ProgressBarProps extends Omit<
    HTMLAttributes<HTMLDivElement>,
    'onChange' | 'onDragStart' | 'onDragEnd'
> {
    /** 进度值 0–100 */
    value?: number;
    /** 缓冲进度 0–100（仅 slim 变体可见） */
    buffered?: number;
    /** 变体 */
    variant?: ProgressBarVariant;
    /** 是否可交互（拖拽/点击） */
    interactive?: boolean;
    /** 进度变化回调，值 0–100 */
    onChange?: (value: number) => void;
    /** 拖拽开始 */
    onDragStart?: () => void;
    /** 拖拽结束 */
    onDragEnd?: (value: number) => void;
}

/**
 * ProgressBar — 原子组件
 *
 * 三种变体：
 *   - `slim`    — 纤细轨道 3px → hover 5px，有 thumb，支持缓冲条
 *   - `thick`   — 粗轨道 6px，无 thumb，无 hover 效果
 *   - `labeled` — 中等轨道 4px，无 thumb，附带百分比文字
 */
const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
    (
        {
            value = 0,
            buffered = 0,
            variant = 'slim',
            interactive = true,
            onChange,
            onDragStart,
            onDragEnd,
            className,
            ...rest
        },
        ref,
    ) => {
        const trackRef = useRef<HTMLDivElement>(null);
        const draggingRef = useRef(false);

        const clamp = (v: number) => Math.max(0, Math.min(100, v));
        const safeValue = clamp(value);
        const safeBuffered = clamp(buffered);

        const getValueFromEvent = useCallback((clientX: number): number => {
            if (!trackRef.current) return 0;
            const rect = trackRef.current.getBoundingClientRect();
            const pct = ((clientX - rect.left) / rect.width) * 100;
            return clamp(Math.round(pct));
        }, []);

        const handleMouseDown = useCallback(
            (e: MouseEvent) => {
                if (!interactive) return;
                e.preventDefault();
                draggingRef.current = true;
                onDragStart?.();
                const newVal = getValueFromEvent(e.clientX);
                onChange?.(newVal);

                const handleMouseMove = (ev: globalThis.MouseEvent) => {
                    if (!draggingRef.current) return;
                    const v = getValueFromEvent(ev.clientX);
                    onChange?.(v);
                };

                const handleMouseUp = (ev: globalThis.MouseEvent) => {
                    if (!draggingRef.current) return;
                    draggingRef.current = false;
                    const v = getValueFromEvent(ev.clientX);
                    onDragEnd?.(v);
                    window.removeEventListener('mousemove', handleMouseMove);
                    window.removeEventListener('mouseup', handleMouseUp);
                };

                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
            },
            [interactive, onChange, onDragStart, onDragEnd, getValueFromEvent],
        );

        const wrapperClassNames = cn(
            'progress-bar',
            `progress-bar--${variant}`,
            interactive && 'progress-bar--interactive',
            className,
        );

        return (
            <div ref={ref} className={wrapperClassNames} {...rest}>
                <div ref={trackRef} className="progress-bar__track" onMouseDown={handleMouseDown}>
                    {/* 缓冲条（仅 slim） */}
                    {variant === 'slim' && safeBuffered > 0 && (
                        <div
                            className="progress-bar__buffered"
                            style={{ width: `${safeBuffered}%` }}
                        />
                    )}
                    {/* 填充条 */}
                    <div className="progress-bar__fill" style={{ width: `${safeValue}%` }} />
                    {/* Thumb（仅 slim 变体） */}
                    {variant === 'slim' && (
                        <div className="progress-bar__thumb" style={{ left: `${safeValue}%` }} />
                    )}
                </div>
                {/* 百分比文字（仅 labeled 变体） */}
                {variant === 'labeled' && (
                    <span className="progress-bar__text">{Math.round(safeValue)}%</span>
                )}
            </div>
        );
    },
);

ProgressBar.displayName = 'ProgressBar';

export { ProgressBar };
