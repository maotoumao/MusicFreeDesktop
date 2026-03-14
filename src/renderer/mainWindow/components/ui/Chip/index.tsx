import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

export interface ChipProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'prefix'> {
    /** 显示文本 */
    label: string;
    /** 选中态 */
    active?: boolean;
    /** 禁用态 */
    disabled?: boolean;
    /** 前置内容（图标等） */
    prefix?: ReactNode;
    /** 后置内容（图标、关闭按钮等） */
    suffix?: ReactNode;
}

/**
 * Chip — 原子组件
 *
 * 可交互紧凑胶囊元素，用于筛选标签、可删除标签等场景。
 *
 * 设计稿还原（像素级）：
 *   容器: inline-flex, items-center, gap-6,
 *         px-12 py-6, rounded-full, text-xs(12px)
 *   默认: bg fill-subtle, color text-secondary
 *   hover: color text-primary
 *   激活: bg fill-neutral-active, color text-primary
 *   禁用: opacity disabled, pointer-events none
 *   active(:active): scale(0.97)
 */
export function Chip({
    label,
    active = false,
    disabled = false,
    prefix,
    suffix,
    className,
    ...rest
}: ChipProps) {
    const classNames = cn('chip', active && 'is-active', disabled && 'is-disabled', className);

    return (
        <button
            type="button"
            className={classNames}
            disabled={disabled}
            aria-pressed={active}
            {...rest}
        >
            {prefix && <span className="chip__prefix">{prefix}</span>}
            <span className="chip__label">{label}</span>
            {suffix && <span className="chip__suffix">{suffix}</span>}
        </button>
    );
}

export default Chip;
