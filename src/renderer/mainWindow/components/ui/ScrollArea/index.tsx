import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
    /** 滚动方向 */
    orientation?: 'vertical' | 'horizontal' | 'both';
    /** 是否隐藏滚动条 */
    hideScrollbar?: boolean;
    /** 内容 */
    children: ReactNode;
}

/**
 * ScrollArea — 原子组件
 *
 * 封装自定义滚动条容器。
 * 全局滚动条样式在 global.scss 中定义（6px 宽、圆角滑块），
 * hideScrollbar 通过组件内部 modifier 实现，不依赖全局 utility class。
 */
const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
    ({ orientation = 'vertical', hideScrollbar = false, children, className, ...rest }, ref) => {
        const classNames = cn(
            'scroll-area',
            `scroll-area--${orientation}`,
            hideScrollbar && 'scroll-area--hide-scrollbar',
            className,
        );

        return (
            <div ref={ref} className={classNames} {...rest}>
                {children}
            </div>
        );
    },
);

ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
