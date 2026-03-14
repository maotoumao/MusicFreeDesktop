import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface SelectOption {
    /** 选项值 */
    value: string;
    /** 显示文本 */
    label: string;
    /** 是否禁用 */
    disabled?: boolean;
}

export interface SelectProps {
    /** 当前选中值 */
    value: string;
    /** 选项列表 */
    options: SelectOption[];
    /** 值变化回调 */
    onChange?: (value: string) => void;
    /** 占位文本 */
    placeholder?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 额外 className */
    className?: string;
}

/**
 * Select — 组合组件（自绘下拉）
 */
function Select({
    value,
    options,
    onChange,
    placeholder,
    disabled = false,
    className,
}: SelectProps) {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder ?? t('common.select_hint');
    const [open, setOpen] = useState(false);
    const [dropUp, setDropUp] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selected = options.find((opt) => opt.value === value);

    // ── 点击外部关闭 ──
    useEffect(() => {
        if (!open) return;

        const handler = (e: MouseEvent) => {
            if (!wrapperRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };

        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [open]);

    // ── 自动检测弹出方向 ──
    useEffect(() => {
        if (!open || !wrapperRef.current) return;

        const rect = wrapperRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const estimatedHeight = Math.min(260, options.length * 40 + 8);
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top;

        setDropUp(spaceBelow < estimatedHeight && spaceAbove > spaceBelow);
    }, [open, options.length]);

    // ── 打开时滚动到选中项 ──
    useEffect(() => {
        if (!open) return;
        // 等 DOM 渲染完成后再滚动
        requestAnimationFrame(() => {
            const el = dropdownRef.current?.querySelector('.is-selected');
            el?.scrollIntoView({ block: 'nearest' });
        });
    }, [open]);

    // ── ESC 关闭 ──
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    const handleToggle = useCallback(() => {
        if (!disabled) setOpen((prev) => !prev);
    }, [disabled]);

    const handleSelect = useCallback(
        (optValue: string) => {
            onChange?.(optValue);
            setOpen(false);
        },
        [onChange],
    );

    const wrapperClassNames = cn('select', open && 'is-open', disabled && 'is-disabled', className);

    return (
        <div ref={wrapperRef} className={wrapperClassNames}>
            {/* ── 触发器 ── */}
            <button
                type="button"
                className="select__trigger"
                onClick={handleToggle}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span
                    className={cn('select__value', !selected && 'select__value--placeholder')}
                    title={selected?.label ?? resolvedPlaceholder}
                >
                    {selected?.label ?? resolvedPlaceholder}
                </span>
                <span className={cn('select__arrow', open && 'is-flipped')}>▼</span>
            </button>

            {/* ── 下拉面板 ── */}
            {open && (
                <div
                    ref={dropdownRef}
                    className={cn(
                        'select__dropdown',
                        dropUp ? 'select__dropdown--up' : 'select__dropdown--down',
                    )}
                    role="listbox"
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        const optClassNames = cn(
                            'select__option',
                            isSelected && 'is-selected',
                            opt.disabled && 'is-disabled',
                        );

                        return (
                            <button
                                key={opt.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                className={optClassNames}
                                disabled={opt.disabled}
                                title={opt.label}
                                onClick={() => handleSelect(opt.value)}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export { Select };
