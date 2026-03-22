import { type HTMLAttributes, type ReactNode, useCallback, useState, useEffect } from 'react';
import { cn } from '@common/cn';
import defaultCover from '@assets/imgs/album-cover.jpg';
import './index.scss';

export type ArtworkSize = 'sm' | 'md' | 'lg' | 'xl' | 'auto';

export interface ArtworkProps extends HTMLAttributes<HTMLDivElement> {
    /** 封面图片 URL */
    src?: string;
    /** alt 文字 */
    alt?: string;
    /** 圆角档位：sm(8px) | md(12px) | lg(24px) */
    rounded?: 'sm' | 'md' | 'lg';
    /** 尺寸预设 */
    size?: ArtworkSize;
    /** 自定义占位内容（当无 src 时显示；默认为 album-cover.jpg） */
    fallback?: ReactNode;
    /** 悬浮覆盖层（如播放按钮） */
    overlay?: ReactNode;
}

const ARTWORK_SIZES: Record<ArtworkSize, number> = {
    sm: 48,
    md: 120,
    lg: 200,
    xl: 320,
    auto: 0, // 由内容撑开，CSS 中设置 max-width: 100%
};

/**
 * Artwork — 原子组件
 *
 * 正方形封面容器，支持占位、hover overlay。
 * 加载失败时自动回退到默认封面图。
 */
export function Artwork({
    src,
    alt = '',
    rounded = 'md',
    size = 'md',
    fallback,
    overlay,
    className,
    style,
    ...rest
}: ArtworkProps) {
    const dimension = ARTWORK_SIZES[size] || '100%';
    const [imgError, setImgError] = useState(false);

    // src 变更时重置错误状态
    useEffect(() => {
        setImgError(false);
    }, [src]);

    const handleImgError = useCallback(() => {
        setImgError(true);
    }, []);

    const classNames = cn('artwork', `artwork--${rounded}`, className);

    // 实际显示的图片源：原始 src 加载失败时回退到默认封面
    const displaySrc = src && !imgError ? src : undefined;

    return (
        <div
            className={classNames}
            style={{ width: dimension, height: dimension, ...style }}
            {...rest}
        >
            {displaySrc ? (
                <img
                    className="artwork__img"
                    src={displaySrc}
                    alt={alt}
                    loading="lazy"
                    draggable={false}
                    onError={handleImgError}
                />
            ) : fallback ? (
                <div className="artwork__fallback">{fallback}</div>
            ) : (
                <img className="artwork__img" src={defaultCover} alt={alt} draggable={false} />
            )}
            {overlay && <div className="artwork__overlay">{overlay}</div>}
        </div>
    );
}

export default Artwork;
