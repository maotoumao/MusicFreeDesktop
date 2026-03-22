// ============================================================================
// QueueDrawer — 播放队列抽屉
// ============================================================================
//
// 布局组件，从右侧滑入，展示当前播放队列。
// 使用 react-virtuoso 虚拟化列表以支持上万首歌曲。
// 打开时自动滚动到正在播放的歌曲。
//
// 状态驱动: jotai atom (queueDrawerState.ts)
// 基础组件: ui/Drawer (提供面板框架、动画、遮罩、键盘关闭)

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai/react';
import { Virtuoso } from 'react-virtuoso';
import { X, Play, ListMusic } from 'lucide-react';
import { cn } from '@common/cn';
import { isSameMedia } from '@common/mediaKey';
import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { useCurrentMusic, useMusicQueue } from '@renderer/mainWindow/core/trackPlayer/hooks';
import Drawer from '../../ui/Drawer';
import { queueDrawerOpenAtom, closeQueueDrawer } from './queueDrawerState';
import './index.scss';
import { showContextMenu } from '../../ui/ContextMenu/contextMenuManager';
import { PLAY_QUEUE_SHEET_ID } from '@infra/musicSheet/common/constant';

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 48;

// ────────────────────────────────────────────────────────────────────────────
// QueueItemRow (memoized)
// ────────────────────────────────────────────────────────────────────────────

interface QueueItemRowProps {
    item: IMusicItemSlim;
    index: number;
    isActive: boolean;
    onPlay: (index: number) => void;
    onRemove: (item: IMusicItemSlim) => void;
    onContextMenu: (item: IMusicItemSlim, e: React.MouseEvent) => void;
}

const QueueItemRow = React.memo(function QueueItemRow({
    item,
    index,
    isActive,
    onPlay,
    onRemove,
    onContextMenu,
}: QueueItemRowProps) {
    const { t } = useTranslation();
    const handleDoubleClick = useCallback(() => onPlay(index), [onPlay, index]);

    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            onContextMenu(item, e);
        },
        [onContextMenu, item],
    );

    const handleRemoveClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onRemove(item);
        },
        [onRemove, item],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPlay(index);
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                onRemove(item);
            }
        },
        [onPlay, onRemove, index, item],
    );

    return (
        <div
            className={cn('l-queue-drawer__item', isActive && 'is-active')}
            style={{ height: ITEM_HEIGHT }}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="option"
            aria-selected={isActive}
        >
            {/* Active indicator bar */}
            {isActive && <div className="l-queue-drawer__active-bar" />}

            {/* Index / Equalizer */}
            <div className="l-queue-drawer__item-index">
                {isActive ? (
                    <div className="l-queue-drawer__equalizer">
                        <span className="l-queue-drawer__eq-bar l-queue-drawer__eq-bar--1" />
                        <span className="l-queue-drawer__eq-bar l-queue-drawer__eq-bar--2" />
                        <span className="l-queue-drawer__eq-bar l-queue-drawer__eq-bar--3" />
                    </div>
                ) : (
                    <>
                        <span className="l-queue-drawer__item-num">{index + 1}</span>
                        <Play size={12} className="l-queue-drawer__item-play" />
                    </>
                )}
            </div>

            {/* Track info */}
            <div className="l-queue-drawer__item-info">
                <div className="l-queue-drawer__item-title">{item.title}</div>
                <div className="l-queue-drawer__item-meta">
                    <span className="l-queue-drawer__item-artist">{item.artist}</span>
                    <span className="l-queue-drawer__item-source">{item.platform}</span>
                </div>
            </div>

            {/* Remove button */}
            <button
                className="l-queue-drawer__item-remove"
                onClick={handleRemoveClick}
                title={t('playback.remove_from_queue')}
                aria-label={t('playback.remove_item', { title: item.title })}
                type="button"
            >
                <X size={12} />
            </button>
        </div>
    );
});

// ────────────────────────────────────────────────────────────────────────────
// Virtuoso 自定义 List 容器（避免裸 div 选择器耐合 Virtuoso 内部 DOM）
// ────────────────────────────────────────────────────────────────────────────

const VirtuosoList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => (
        <div ref={ref} {...props} className={cn(props.className, 'l-queue-drawer__list-inner')} />
    ),
);
VirtuosoList.displayName = 'VirtuosoList';

const virtuosoComponents = { List: VirtuosoList };

// ────────────────────────────────────────────────────────────────────────────
// QueueDrawer
// ────────────────────────────────────────────────────────────────────────────

/**
 * QueueDrawer
 * @layer layout
 *
 * 右侧滑出的播放队列抽屉。
 * - 使用 Virtuoso 虚拟滚动渲染队列列表
 * - 高亮当前播放项并自动滚动到视口
 * - 支持单曲移除和清空队列操作
 */
export default function QueueDrawer() {
    const { t } = useTranslation();
    const open = useAtomValue(queueDrawerOpenAtom);
    const queue = useMusicQueue();
    const currentMusic = useCurrentMusic();

    // 计算当前播放的索引
    const activeIndex = useMemo(() => {
        if (!currentMusic) return -1;
        return queue.findIndex((item) => isSameMedia(item, currentMusic));
    }, [queue, currentMusic]);

    // Drawer 使用 AnimatePresence，关闭时 Virtuoso 会卸载；
    // 重新打开时 Virtuoso 重新挂载，initialTopMostItemIndex 自然生效。
    const initialTopMostItemIndex = useMemo(
        () => (activeIndex >= 0 ? { index: activeIndex, align: 'center' as const } : 0),
        [activeIndex],
    );

    // ── Handlers ──
    const handlePlay = useCallback((index: number) => {
        trackPlayer.playIndex(index);
    }, []);

    const handleRemove = useCallback((item: IMusicItemSlim) => {
        trackPlayer.removeMusic(item);
    }, []);

    const handleContextMenu = useCallback((item: IMusicItemSlim, e: React.MouseEvent) => {
        showContextMenu(
            'MusicItemMenu',
            {
                x: e.clientX,
                y: e.clientY,
            },
            {
                musicItems: item,
                sheetId: PLAY_QUEUE_SHEET_ID,
            },
        );
    }, []);

    const handleClear = useCallback(() => {
        trackPlayer.reset();
    }, []);

    // ── Virtuoso: itemContent ──
    const itemContent = useCallback(
        (index: number, item: IMusicItemSlim) => (
            <QueueItemRow
                item={item}
                index={index}
                isActive={index === activeIndex}
                onPlay={handlePlay}
                onRemove={handleRemove}
                onContextMenu={handleContextMenu}
            />
        ),
        [activeIndex, handlePlay, handleRemove, handleContextMenu],
    );

    // ── Header（覆盖 Drawer 默认 header） ──
    const header = useMemo(
        () => (
            <div className="l-queue-drawer__header">
                <div className="l-queue-drawer__header-left">
                    <h3 className="l-queue-drawer__title">{t('playback.queue_title')}</h3>
                    {queue.length > 0 && (
                        <span className="l-queue-drawer__count">
                            {t('playback.queue_count', { count: queue.length })}
                        </span>
                    )}
                </div>
                <div className="l-queue-drawer__header-right">
                    {queue.length > 0 && (
                        <button
                            className="l-queue-drawer__clear-btn"
                            onClick={handleClear}
                            type="button"
                        >
                            {t('playback.clear_queue')}
                        </button>
                    )}
                    <button
                        className="l-queue-drawer__close-btn"
                        onClick={closeQueueDrawer}
                        type="button"
                        aria-label={t('playback.close_queue')}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        ),
        [queue.length, handleClear],
    );

    return (
        <Drawer
            open={open}
            onClose={closeQueueDrawer}
            closable={false}
            showOverlay={false}
            closeOnClickOutside
            className="l-queue-drawer"
        >
            {/* Custom header — Drawer closable=false, 我们自己画 header */}
            {header}

            {/* Divider */}
            <div className="l-queue-drawer__divider" />

            {/* Body */}
            {queue.length === 0 ? (
                <div className="l-queue-drawer__empty">
                    <ListMusic size={48} strokeWidth={1.5} className="l-queue-drawer__empty-icon" />
                    <div className="l-queue-drawer__empty-title">
                        {t('playback.queue_empty_title')}
                    </div>
                    <div className="l-queue-drawer__empty-desc">
                        {t('playback.queue_empty_desc')}
                    </div>
                </div>
            ) : (
                <Virtuoso
                    data={queue}
                    initialTopMostItemIndex={initialTopMostItemIndex}
                    fixedItemHeight={ITEM_HEIGHT}
                    itemContent={itemContent}
                    components={virtuosoComponents}
                    className="l-queue-drawer__list"
                    role="listbox"
                    aria-label={t('playback.queue_list_label')}
                />
            )}
        </Drawer>
    );
}
