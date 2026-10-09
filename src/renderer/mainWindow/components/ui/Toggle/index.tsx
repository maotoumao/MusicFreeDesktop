import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@common/cn';
import './index.scss';

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    /** 是否选中 */
    checked?: boolean;
    /** 变化回调 */
    onChange?: (checked: boolean) => void;
}

/**
 * Toggle — 组合组件
 *
 * 设计稿还原（像素级）：
 *   轨道: 48×24，rounded-full
 *     off → bg neutral, border strong
 *     on  → bg brand, border brand
 *   旋钮: 20×20，白色，rounded-full
 *     off → translateX(2px)
 *     on  → translateX(26px)  (48 - 20 - 2)
 *   transition: 200ms standard easing
 */
const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
    ({ checked = false, onChange, disabled = false, className, ...rest }, ref) => {
        const classNames = cn('toggle', checked && 'is-on', disabled && 'is-disabled', className);

        return (
            <button
                ref={ref}
                type="button"
                role="switch"
                aria-checked={checked}
                aria-disabled={disabled}
                className={classNames}
                disabled={disabled}
                onClick={() => onChange?.(!checked)}
                {...rest}
            >
                <span className="toggle__thumb" />
            </button>
        );
    },
);

Toggle.displayName = 'Toggle';

export { Toggle };
