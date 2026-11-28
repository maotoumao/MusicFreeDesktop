import { type ReactNode, useCallback } from 'react';
import { cn } from '@common/cn';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface CheckboxOption {
    /** 选项值 */
    value: string;
    /** 显示文本 */
    label: string;
    /** 前置图标 */
    icon?: ReactNode;
    /** 是否禁用 */
    disabled?: boolean;
}

export interface CheckboxGroupProps {
    /** 当前选中值（多选） */
    value: string[];
    /** 选项列表 */
    options: CheckboxOption[];
    /** 值变化回调 */
    onChange?: (value: string[]) => void;
    /** 是否禁用整体 */
    disabled?: boolean;
    /** 额外 className */
    className?: string;
}

/**
 * CheckboxGroup — 原子组件
 *
 * 纯内联 checkbox 列表，每项由自定义勾选框 + 文本标签组成。
 * 选中态录用 Toggle 同系 emerald 配色，保持视觉一致性。
 *
 * 设计规格：
 *   容器: inline-flex, gap 16px
 *   勾选框: 16×16, rounded 4px, border 1.5px
 *     off → border default, bg transparent
 *     on  → bg emerald-400/70, border emerald-400/80, 白色✓
 *   文本: text-caption, color-text-primary
 *   transition: 200ms standard easing
 */
export function CheckboxGroup({
    value,
    options,
    onChange,
    disabled = false,
    className,
}: CheckboxGroupProps) {
    const handleToggle = useCallback(
        (optValue: string) => {
            if (!onChange) return;
            const next = value.includes(optValue)
                ? value.filter((v) => v !== optValue)
                : [...value, optValue];
            onChange(next);
        },
        [value, onChange],
    );

    return (
        <div className={cn('checkbox-group', disabled && 'is-disabled', className)} role="group">
            {options.map((opt) => {
                const checked = value.includes(opt.value);
                const isDisabled = disabled || opt.disabled;

                return (
                    <label
                        key={opt.value}
                        className={cn(
                            'checkbox-group__item',
                            checked && 'is-checked',
                            isDisabled && 'is-disabled',
                        )}
                    >
                        <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            className="checkbox-group__box"
                            disabled={isDisabled}
                            onClick={() => {
                                if (!isDisabled) handleToggle(opt.value);
                            }}
                        >
                            <svg className="checkbox-group__check" viewBox="0 0 12 12" fill="none">
                                <path
                                    d="M2.5 6L5 8.5L9.5 3.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                        {opt.icon && <span className="checkbox-group__icon">{opt.icon}</span>}
                        <span className="checkbox-group__label">{opt.label}</span>
                    </label>
                );
            })}
        </div>
    );
}

export default CheckboxGroup;
