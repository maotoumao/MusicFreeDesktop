import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'sq';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** 按钮变体 */
    variant?: ButtonVariant;
    /** 按钮尺寸 */
    size?: ButtonSize;
    /** 是否处于加载状态 */
    loading?: boolean;
    /** 危险按钮（红色色调，可与任意 variant 组合） */
    danger?: boolean;
    /** 前置图标 */
    icon?: ReactNode;
    /** 按钮内容 */
    children?: ReactNode;
}

/**
 * Button — 原子组件
 *
 * 四种变体 × 四种尺寸，支持 loading / disabled 状态。
 * 所有样式通过 BEM + CSS 变量实现。
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            loading = false,
            disabled = false,
            danger = false,
            icon,
            children,
            className,
            ...rest
        },
        ref,
    ) => {
        const isDisabled = disabled || loading;

        const classNames = cn(
            'btn',
            `btn--${variant}`,
            `btn--${size}`,
            loading && 'btn--loading',
            danger && 'btn--danger',
            isDisabled && 'is-disabled',
            className,
        );

        return (
            <button
                ref={ref}
                className={classNames}
                disabled={isDisabled}
                aria-disabled={isDisabled}
                aria-busy={loading}
                {...rest}
            >
                {loading && <span className="btn__spinner" aria-hidden="true" />}
                {!loading && icon && <span className="btn__icon">{icon}</span>}
                {children && <span className="btn__label">{children}</span>}
            </button>
        );
    },
);

Button.displayName = 'Button';

export { Button };
