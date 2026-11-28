import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
    /** 头像图片 URL */
    src?: string;
    /** alt 文字 */
    alt?: string;
    /** 尺寸 */
    size?: AvatarSize;
    /** 占位（当无 src 时显示的内容，如首字母） */
    fallback?: ReactNode;
}

const AVATAR_SIZES: Record<AvatarSize, number> = {
    sm: 20,
    md: 40,
    lg: 120,
};

/**
 * Avatar — 原子组件
 *
 * 圆形头像，带占位和阴影。
 */
export function Avatar({
    src,
    alt = '',
    size = 'md',
    fallback,
    className,
    style,
    ...rest
}: AvatarProps) {
    const dimension = AVATAR_SIZES[size];

    const classNames = cn('avatar', className);

    return (
        <div
            className={classNames}
            style={{ width: dimension, height: dimension, ...style }}
            {...rest}
        >
            {src ? (
                <img className="avatar__img" src={src} alt={alt} loading="lazy" draggable={false} />
            ) : (
                <span className="avatar__fallback">{fallback}</span>
            )}
        </div>
    );
}

export default Avatar;
