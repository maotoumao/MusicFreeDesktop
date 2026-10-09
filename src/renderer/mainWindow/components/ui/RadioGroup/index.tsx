import { type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface RadioOption {
    /** 选项值 */
    value: string;
    /** 显示文本 */
    label: string;
    /** 前置图标 */
    icon?: ReactNode;
    /** 是否禁用 */
    disabled?: boolean;
}

export interface RadioGroupProps {
    /** 当前选中值 */
    value: string;
    /** 选项列表 */
    options: RadioOption[];
    /** 值变化回调 */
    onChange?: (value: string) => void;
    /** 是否禁用整体 */
    disabled?: boolean;
    /** 额外 className */
    className?: string;
}

/**
 * RadioGroup — 组合组件
 *
 * 设计稿还原（像素级）：
 *   容器: inline-flex, rounded-full, bg white/5,
 *         border 1px white/10, padding 4px, gap 4px
 *   选项: px-12 py-4, rounded-full, text-xs(12px)
 *     默认 → color secondary, hover → color primary
 *     选中 → bg white/15, color primary
 *   transition: 200ms standard
 */
export function RadioGroup({
    value,
    options,
    onChange,
    disabled = false,
    className,
}: RadioGroupProps) {
    const wrapperClassNames = cn('radio-group', disabled && 'is-disabled', className);

    return (
        <div className={wrapperClassNames} role="radiogroup">
            {options.map((opt) => {
                const isSelected = opt.value === value;
                const isDisabled = disabled || opt.disabled;
                const optClassNames = cn(
                    'radio-group__option',
                    isSelected && 'is-selected',
                    isDisabled && 'is-disabled',
                );

                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={optClassNames}
                        disabled={isDisabled}
                        onClick={() => {
                            if (!isDisabled) onChange?.(opt.value);
                        }}
                    >
                        {opt.icon && <span className="radio-group__option-icon">{opt.icon}</span>}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

export default RadioGroup;
