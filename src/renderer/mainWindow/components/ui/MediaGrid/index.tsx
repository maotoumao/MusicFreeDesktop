import React, {
    useRef,
    useCallback,
    useEffect,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
} from 'react';
import { Play } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@common/cn';
import { RequestStatus } from '@common/constant';
import { Artwork } from '../Artwork';
import { ListFooter } from '../ListFooter';
import { StatusPlaceholder } from '../StatusPlaceholder';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface MediaGridProps {
    /** 数据列表（歌单 / 专辑 / 排行榜等） */
    data: IMusic.IMusicSheetItem[];
    /** 卡片点击 */
    onItemClick?: (item: IMusic.IMusicSheetItem) => void;
    /** 卡片右键 */
    onItemContextMenu?: (item: IMusic.IMusicSheetItem, e: ReactMouseEvent) => void;
    /** 播放按钮点击（传入后显示播放 FAB） */
    onPlayClick?: (item: IMusic.IMusicSheetItem) => void;

    // ── 加载状态 ──
    /** 请求状态 */
    requestStatus?: RequestStatus;
    /** 首次加载失败时的重试回调（传入后 StatusPlaceholder 展示"重试"按钮） */
    onRetry?: () => void;
    /** 错误态文案（不传则使用 StatusPlaceholder 默认值 "加载失败"） */
    errorTitle?: string;
    /** 空态文案 */
    emptyTitle?: string;
    /** 空态图标 */
    emptyIcon?: LucideIcon;

    // ── 底部加载更多 ──
    /** 是否启用滚动加载更多 @default false */
    enableLoadMore?: boolean;
    /** 加载更多状态 */
    loadMoreStatus?: RequestStatus;
    /** 加载更多回调 */
    onLoadMore?: () => void;
    /** 加载更多重试 */
    onLoadMoreRetry?: () => void;

    /** 封面占位图标 */
    placeholderIcon?: ReactNode;
    /** 额外 className */
    className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// MediaGrid — 主组件
// ────────────────────────────────────────────────────────────────────────────

/**
 * MediaGrid — 模式组件
 *
 * 响应式媒体卡片网格，用于展示专辑、歌单、歌手等。
 *
 * 设计稿还原（像素级）：
 *   网格: repeat(auto-fill, minmax(160px, 1fr)), gap 24px
 *   卡片: padding 12px, radius-card, bg-surface, hover bg-surface-raised, transition moderate
 *   封面: aspect-ratio 1/1, radius-control, shadow-sm
 *   标题: 13px semibold, truncate
 *   副标题: 12px secondary, truncate
 *   PlayFAB: 36×36, bg brand, pill, opacity 0→1 on hover
 */
export function MediaGrid({
    data,
    onItemClick,
    onItemContextMenu,
    onPlayClick,
    requestStatus,
    onRetry,
    errorTitle,
    emptyTitle,
    emptyIcon,
    enableLoadMore = false,
    loadMoreStatus,
    onLoadMore,
    onLoadMoreRetry,
    placeholderIcon,
    className,
}: MediaGridProps) {
    // ── IntersectionObserver 哨兵（加载更多） ──
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!enableLoadMore || !onLoadMore) return;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && loadMoreStatus !== RequestStatus.Pending) {
                    onLoadMore();
                }
            },
            { rootMargin: '200px' },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [enableLoadMore, onLoadMore, loadMoreStatus]);

    // ── 首次加载占位 ──
    if (data.length === 0) {
        if (requestStatus === RequestStatus.Pending) {
            return <StatusPlaceholder status={RequestStatus.Pending} />;
        }
        if (requestStatus === RequestStatus.Error) {
            return (
                <StatusPlaceholder
                    status={RequestStatus.Error}
                    errorTitle={errorTitle}
                    onRetry={onRetry}
                />
            );
        }
        if (
            !requestStatus ||
            requestStatus === RequestStatus.Done ||
            requestStatus === RequestStatus.Idle
        ) {
            return (
                <StatusPlaceholder
                    status={RequestStatus.Done}
                    isEmpty
                    emptyIcon={emptyIcon}
                    emptyTitle={emptyTitle ?? '暂无内容'}
                />
            );
        }
    }

    return (
        <div className={cn('media-grid', className)}>
            <div className="media-grid__grid">
                {data.map((item) => (
                    <MediaCard
                        key={item.id}
                        item={item}
                        onItemClick={onItemClick}
                        onItemContextMenu={onItemContextMenu}
                        onPlayClick={onPlayClick}
                        placeholderIcon={placeholderIcon}
                    />
                ))}
            </div>

            {/* 加载更多哨兵 */}
            {enableLoadMore && <div ref={sentinelRef} className="media-grid__sentinel" />}
            {enableLoadMore && (
                <ListFooter
                    status={loadMoreStatus ?? RequestStatus.Done}
                    onRetry={onLoadMoreRetry}
                />
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// MediaCard — 单张卡片
// ────────────────────────────────────────────────────────────────────────────

const MediaCard = React.memo(function MediaCard({
    item,
    onItemClick,
    onItemContextMenu,
    onPlayClick,
    placeholderIcon,
}: {
    item: IMusic.IMusicSheetItem;
    onItemClick?: (item: IMusic.IMusicSheetItem) => void;
    onItemContextMenu?: (item: IMusic.IMusicSheetItem, e: ReactMouseEvent) => void;
    onPlayClick?: (item: IMusic.IMusicSheetItem) => void;
    placeholderIcon?: ReactNode;
}) {
    const handleClick = useCallback(() => {
        onItemClick?.(item);
    }, [item, onItemClick]);

    const handleContextMenu = useCallback(
        (e: ReactMouseEvent) => {
            onItemContextMenu?.(item, e);
        },
        [item, onItemContextMenu],
    );

    const handlePlayClick = useCallback(
        (e: ReactMouseEvent) => {
            e.stopPropagation();
            onPlayClick?.(item);
        },
        [item, onPlayClick],
    );

    return (
        <div className="media-card" onClick={handleClick} onContextMenu={handleContextMenu}>
            {/* 封面 */}
            <div className="media-card__cover-wrapper">
                <Artwork
                    src={item.artwork}
                    alt={item.title}
                    rounded="sm"
                    size="auto"
                    fallback={placeholderIcon}
                    className="media-card__cover"
                />

                {/* 播放 FAB */}
                {onPlayClick && (
                    <button
                        type="button"
                        className="media-card__play-fab"
                        onClick={handlePlayClick}
                        aria-label={`播放 ${item.title}`}
                    >
                        <Play size={18} fill="currentColor" />
                    </button>
                )}
            </div>

            {/* 文字 */}
            <div className="media-card__info">
                <div className="media-card__title" title={item.title}>
                    {item.title}
                </div>
                {item.artist && (
                    <div className="media-card__subtitle" title={item.artist}>
                        {item.artist}
                    </div>
                )}
            </div>
        </div>
    );
});

export default MediaGrid;
