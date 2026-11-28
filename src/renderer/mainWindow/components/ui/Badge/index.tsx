import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

export type BadgeVariant = 'outline' | 'filled' | 'tint';
export type BadgeColorScheme = 'default' | 'danger' | 'warn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    /** 徽章变体 */
    variant?: BadgeVariant;
    /** 色彩语义，可与任意 variant 正交组合 */
    colorScheme?: BadgeColorScheme;
    children: ReactNode;
}

/**
 * Badge — 原子组件
 *
 * 三种变体：outline（描边）、filled（填充）、tint（品牌色调）。
 * 三种色彩语义：default（品牌色）、danger（红色）、warn（橙色）。
 *
 * 设计稿还原（像素级）：
 *   容器: inline-flex, items-center, nowrap, leading-1
 *   outline: text badge-size, color text-muted, border 1px border-strong,
 *            rounded badge(4px), px-6 py-4, font-weight medium
 *   filled:  text badge-size, color text-on-brand, bg fill-brand,
 *            rounded pill, px-8 py-5, font-weight medium
 *   tint:    text badge-size, color text-brand, bg fill-brand-muted,
 *            border 1px border-brand, rounded pill, px-8 py-4, font-weight medium
 */
export function Badge({
    variant = 'outline',
    colorScheme = 'default',
    children,
    className,
    ...rest
}: BadgeProps) {
    const classNames = cn(
        'badge',
        `badge--${variant}`,
        colorScheme !== 'default' && `badge--${colorScheme}`,
        className,
    );

    return (
        <span className={classNames} {...rest}>
            {children}
        </span>
    );
}

export default Badge;
