import { useCallback, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

export interface ThemeCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    /** 主题名称 */
    name: string;
    /** 主题作者 */
    author?: string;
    /** 预览区内容 */
    preview: ReactNode;
    /** 是否为当前激活主题 */
    active?: boolean;
    /** 底部操作区 */
    footer?: ReactNode;
}

/**
 * ThemeCard — 主题卡片
 *
 * 展示主题预览、名称、作者和操作区域。
 *
 * 设计稿还原（像素级）：
 *   容器: bg fill-subtle, rounded-card (12px), border border-default,
 *         overflow-hidden, p-12, cursor-pointer
 *   hover: border border-strong
 *   激活: border brand + inset box-shadow
 *   预览区: h-120, rounded-control (8px), overflow-hidden, mb-12
 *   名称: text-body (14px), font-bold, text-primary
 *   作者: text-caption (12px), text-secondary
 */
export function ThemeCard({
    name,
    author,
    preview,
    active = false,
    footer,
    className,
    onClick,
    ...rest
}: ThemeCardProps) {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            if ((e.key === 'Enter' || e.key === ' ') && onClick) {
                e.preventDefault();
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
            }
        },
        [onClick],
    );

    return (
        <div
            className={cn('theme-card', active && 'is-active', className)}
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            {...rest}
        >
            <div className="theme-card__preview">{preview}</div>
            <div className="theme-card__info">
                <div className="theme-card__name" title={name}>
                    {name}
                </div>
                {author && (
                    <div className="theme-card__author" title={author}>
                        {author}
                    </div>
                )}
            </div>
            {footer && <div className="theme-card__footer">{footer}</div>}
        </div>
    );
}

export default ThemeCard;
