import React, {
    forwardRef,
    useState,
    useCallback,
    type InputHTMLAttributes,
    type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import './index.scss';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
    /** 前置图标/内容 */
    prefix?: ReactNode;
    /** 后置图标/内容 */
    suffix?: ReactNode;
    /** 是否有错误 */
    hasError?: boolean;
    /** 是否显示清空按钮（有内容时自动显示） */
    allowClear?: boolean;
    /** 清空回调 */
    onClear?: () => void;
}

/**
 * Input — 原子组件
 *
 * 支持 prefix/suffix 插槽、focus/disabled/error 状态。
 * 所有样式通过 BEM + CSS 变量实现。
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            prefix,
            suffix,
            hasError = false,
            disabled = false,
            allowClear = false,
            onClear,
            className,
            onFocus,
            onBlur,
            onChange,
            value,
            defaultValue,
            ...rest
        },
        ref,
    ) => {
        const { t } = useTranslation();
        const [isFocused, setIsFocused] = useState(false);
        const [internalValue, setInternalValue] = useState(defaultValue ?? '');

        // 受控 vs 非受控
        const isControlled = value !== undefined;
        const currentValue = isControlled ? value : internalValue;
        const showClear = allowClear && !disabled && String(currentValue).length > 0;

        const handleFocus = useCallback(
            (e: React.FocusEvent<HTMLInputElement>) => {
                setIsFocused(true);
                onFocus?.(e);
            },
            [onFocus],
        );

        const handleBlur = useCallback(
            (e: React.FocusEvent<HTMLInputElement>) => {
                setIsFocused(false);
                onBlur?.(e);
            },
            [onBlur],
        );

        const handleChange = useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                if (!isControlled) setInternalValue(e.target.value);
                onChange?.(e);
            },
            [isControlled, onChange],
        );

        const handleClear = useCallback(() => {
            if (!isControlled) setInternalValue('');
            onClear?.();
            // 触发 onChange 以保持受控组件兼容
            if (onChange) {
                const nativeEvent = new Event('input', { bubbles: true });
                const syntheticEvent = {
                    target: { value: '' },
                    currentTarget: { value: '' },
                    nativeEvent,
                } as unknown as React.ChangeEvent<HTMLInputElement>;
                onChange(syntheticEvent);
            }
        }, [isControlled, onChange, onClear]);

        const wrapperClassNames = cn(
            'input',
            isFocused && 'is-focused',
            hasError && 'has-error',
            disabled && 'is-disabled',
            className,
        );

        return (
            <div className={wrapperClassNames}>
                {prefix && <span className="input__prefix">{prefix}</span>}
                <input
                    ref={ref}
                    className="input__native"
                    disabled={disabled}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={isControlled ? value : undefined}
                    defaultValue={isControlled ? undefined : (defaultValue as string)}
                    {...rest}
                />
                {showClear && (
                    <button
                        type="button"
                        className="input__clear-btn"
                        tabIndex={-1}
                        aria-label={t('common.clear')}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleClear}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                )}
                {suffix && <span className="input__suffix">{suffix}</span>}
            </div>
        );
    },
);

Input.displayName = 'Input';

export { Input };
