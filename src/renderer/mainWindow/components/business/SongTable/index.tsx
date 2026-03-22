import React, {
    useRef,
    useMemo,
    useCallback,
    useEffect,
    useState,
    type ReactNode,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import { TableVirtuoso, type TableVirtuosoHandle } from 'react-virtuoso';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { tinykeys } from 'tinykeys';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import { RequestStatus } from '@common/constant';
import { useCurrentMusic } from '../../../core/trackPlayer/hooks';
import { ListFooter } from '../../ui/ListFooter';
import { StatusPlaceholder } from '../../ui/StatusPlaceholder';
import './index.scss';
import { isSameMedia } from '@common/mediaKey';
import formatDuration from '@common/formatDuration';
import appConfig from '@infra/appConfig/renderer';
import trackPlayer from '../../../core/trackPlayer';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** 可通过 hideColumns 隐藏的列 key */
export type HideableColumn = 'index' | 'artist' | 'album' | 'platform' | 'duration';

/** 行交互事件的上下文信息 */
export interface RowInteractionDetail {
    /** 被交互的那一项 */
    item: IMusic.IMusicItemBase;
    /** 该项在 data 中的索引 */
    index: number;
    /** 当前生效的选中项列表（至少包含 item 自身） */
    selectedItems: IMusic.IMusicItemBase[];
}

export interface SongTableProps {
    /** 歌曲数据列表 */
    data: IMusic.IMusicItemBase[];
    /** 固定行高 (px) @default 48 */
    rowHeight?: number;

    // ── 加载状态 ──
    /** 请求状态 — 直接透传 StatusPlaceholder */
    requestStatus?: RequestStatus;
    /** 首次加载失败时的重试回调（传入后 StatusPlaceholder 展示"重试"按钮） */
    onRetry?: () => void;

    // ── 底部加载更多 ──
    /** 是否启用滚动到底部自动加载 @default false */
    enableLoadMore?: boolean;
    /** 加载更多的状态 */
    loadMoreStatus?: RequestStatus;
    /** 触发加载更多 */
    onLoadMore?: () => void;
    /** 加载更多失败时的重试 */
    onLoadMoreRetry?: () => void;

    // ── 选择 ──
    /** 是否启用键盘多选 (ctrl/shift/ctrl+a) @default false */
    enableSelection?: boolean;
    /** 当前选中项 ID 集合（受控） */
    selectedIds?: Set<string>;
    /** 选中项变更回调 */
    onSelectionChange?: (ids: Set<string>) => void;

    // ── 拖拽排序 ──
    /** 是否启用拖拽排序（整行可拖） @default false */
    enableDragSort?: boolean;
    /**
     * 拖拽完成回调 — 支持多选批量拖拽。
     *
     * @param fromIndices 被拖拽项在原始数组中的索引（升序排列）
     * @param toIndex 目标位置在原始数组中的索引（drop 目标行的当前位置）
     *
     * 消费侧需自行实现 "从 fromIndices 移出、插入到 toIndex 相对位置" 的数组变换。
     */
    onDragSortEnd?: (fromIndices: number[], toIndex: number) => void;

    // ── 交互 ──
    /**
     * 双击行为覆盖。
     * - 不传：读取全局配置 `playMusic.clickMusicList`
     * - `'normal'`：追加到播放队列并播放
     * - `'replace'`：用当前 `data` 替换播放队列
     *
     * 当传入 `onRowDoubleClick` 时，此属性被忽略。
     */
    doubleClickBehavior?: 'normal' | 'replace';
    /** 行点击 */
    onRowClick?: (detail: RowInteractionDetail, e: ReactMouseEvent) => void;
    /**
     * 行双击 — 完全覆盖内置播放行为。
     * 不传时，SongTable 内部根据 `doubleClickBehavior`（或全局配置）自动处理播放。
     */
    onRowDoubleClick?: (detail: RowInteractionDetail, e: ReactMouseEvent) => void;
    /** 行右键菜单 */
    onRowContextMenu?: (detail: RowInteractionDetail, e: ReactMouseEvent) => void;

    // ── 状态列 ──
    /** 状态列渲染器（不传则不显示状态列；传入后在所有列前追加固定宽列） */
    statusColumn?: (item: IMusic.IMusicItemBase, index: number) => ReactNode;
    /** 状态列表头文案 @default undefined */
    statusColumnHeader?: ReactNode;
    /** 状态列宽度 (px) @default 72 */
    statusColumnWidth?: number;

    /** 是否高亮当前播放歌曲 @default true */
    showActiveIndicator?: boolean;

    /** 需要隐藏的列（标题列不可隐藏） */
    hideColumns?: HideableColumn[];

    /** 外部滚动容器元素（不传则自动查找 .l-app-shell__content 或回退到 window） */
    scrollParent?: HTMLElement;
    /** 额外 className */
    className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal Types
// ────────────────────────────────────────────────────────────────────────────

interface InternalColumn {
    id: string;
    header: ReactNode;
    width?: number | string;
    align?: 'left' | 'center' | 'right';
    cellClassName?: string;
    render: (item: IMusic.IMusicItemBase, index: number) => ReactNode;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const DND_MODIFIERS = [restrictToVerticalAxis];
const DEFAULT_ROW_HEIGHT = 48;
/** 全局滚动容器选择器 */
const SCROLL_CONTAINER_SELECTOR = '.l-app-shell__content';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// DraggableTableRow — 拖拽行（memo 化避免非必要渲染）
// ────────────────────────────────────────────────────────────────────────────

interface DraggableTableRowProps {
    id: string;
    isActive: boolean;
    isSelected: boolean;
    isDragEnabled: boolean;
    isDragGhost: boolean;
    rowHeight: number;
    onClick: (e: ReactMouseEvent) => void;
    onDoubleClick: () => void;
    onContextMenu: (e: ReactMouseEvent) => void;
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
    [key: string]: any;
}

const DraggableTableRow = React.memo(
    function DraggableTableRow({
        id,
        isActive,
        isSelected,
        isDragEnabled,
        isDragGhost,
        rowHeight,
        onClick,
        onDoubleClick,
        onContextMenu,
        className: externalClassName,
        style: externalStyle,
        children,
        ...rest
    }: DraggableTableRowProps) {
        const { attributes, listeners, setNodeRef, isDragging, isOver, activeIndex, index } =
            useSortable({
                id,
                disabled: !isDragEnabled,
            });

        // Drop indicator: show on the hovered row (including dragged row itself)
        const dropPosition =
            isOver && !isDragGhost ? (activeIndex < index ? 'below' : 'above') : null;

        return (
            <tr
                ref={setNodeRef}
                {...rest}
                {...attributes}
                {...listeners}
                className={cn(
                    'song-table__row',
                    isActive && 'is-active',
                    isSelected && 'is-selected',
                    isDragging && 'is-dragging',
                    isDragGhost && 'is-drag-ghost',
                    dropPosition === 'above' && 'is-drop-above',
                    dropPosition === 'below' && 'is-drop-below',
                    externalClassName,
                )}
                style={{
                    ...externalStyle,
                    height: rowHeight,
                }}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                onContextMenu={onContextMenu}
            >
                {children}
            </tr>
        );
    },
    (prev, next) =>
        prev.id === next.id &&
        prev.isActive === next.isActive &&
        prev.isSelected === next.isSelected &&
        prev.isDragEnabled === next.isDragEnabled &&
        prev.isDragGhost === next.isDragGhost &&
        prev.rowHeight === next.rowHeight &&
        prev.className === next.className,
);

// ────────────────────────────────────────────────────────────────────────────
// DragOverlayContent — 拖拽时仅显示多选计数 badge
// ────────────────────────────────────────────────────────────────────────────

function DragOverlayContent({ dragCount }: { dragCount: number }) {
    if (dragCount <= 1) return null;
    return <span className="song-table__drag-count-badge">{dragCount}</span>;
}

// ────────────────────────────────────────────────────────────────────────────
// SongTable — 主组件
// ────────────────────────────────────────────────────────────────────────────

/**
 * SongTable — 歌曲虚拟列表表格（业务组件）
 *
 * 基于 react-virtuoso TableVirtuoso，支持全局滚动、多选拖拽排序、
 * Ctrl/Shift 多选、右键菜单、滚动加载更多、可选状态列。
 *
 * 固定列：序号 (56px) | 标题 (auto) | 歌手 (18%) | 专辑 (16%) | 时长 (80px) | 来源 (88px)
 * 可通过 hideColumns 隐藏部分列；标题列始终可见。
 * 当前播放高亮通过内部 useCurrentMusic() 自动判断。
 *
 * 性能要点：
 *   - virtuosoComponents 仅依赖 colGroup / enableDragSort / rowHeight（稳定值）
 *   - 频繁变化的 data / selectedIds / currentMusic / handlers 全部通过 ref 传递
 *   - fixedHeaderContent / itemContent 仅依赖 columns（列定义极少变化）
 *   - Ctrl+A 通过 tinykeys 绑定到容器 DOM，精简键盘处理
 *
 * 设计稿还原（像素级）：
 *   font: --text-body-size (14px), table-layout fixed
 *   行默认色: --color-text-secondary (灰)
 *   标题列: --color-text-primary (白), --font-weight-medium (500)
 *   表头: --text-caption-size (12px), --color-text-secondary, --font-weight-normal,
 *         border-bottom 1px --color-border-subtle, py-12 px-16
 *   行: px-16, hover bg-surface, fast transition, height 48px
 *   激活行: --color-text-brand (覆盖全行)
 *   选中行: --color-bg-surface-raised
 *   状态列: 72px, 两图标 16×16 gap-8
 *   来源badge: --text-badge-size (10px), white/40, border white/10, px-8 py-2, rounded-sm
 */
export function SongTable({
    data,
    rowHeight = DEFAULT_ROW_HEIGHT,
    requestStatus,
    onRetry,
    enableLoadMore = false,
    loadMoreStatus,
    onLoadMore,
    onLoadMoreRetry,
    enableSelection = false,
    selectedIds: externalSelectedIds,
    onSelectionChange,
    enableDragSort = false,
    onDragSortEnd,
    doubleClickBehavior,
    onRowClick: externalOnRowClick,
    onRowDoubleClick: externalOnRowDoubleClick,
    onRowContextMenu: externalOnRowContextMenu,
    statusColumn,
    statusColumnHeader,
    statusColumnWidth = 72,
    showActiveIndicator = true,
    hideColumns = appConfig.getConfigByKey('normal.musicListHideColumns'),
    scrollParent: externalScrollParent,
    className,
}: SongTableProps) {
    const { t } = useTranslation();
    const currentMusic = useCurrentMusic();
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
    const virtuosoRef = useRef<TableVirtuosoHandle>(null);

    const scrollParent = useMemo(() => {
        if (externalScrollParent) {
            return externalScrollParent;
        }
        const el = document.querySelector(SCROLL_CONTAINER_SELECTOR) as HTMLElement | null;
        return el ?? undefined;
    }, [externalScrollParent]);

    // ── 内部选中态（非受控模式） ──
    const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
    const selectedIds = externalSelectedIds ?? internalSelectedIds;
    const setSelectedIds = useCallback(
        (next: Set<string>) => {
            if (onSelectionChange) {
                onSelectionChange(next);
            } else {
                setInternalSelectedIds(next);
            }
        },
        [onSelectionChange],
    );

    // ── Shift 多选锚点 ──
    const lastClickIndexRef = useRef<number>(-1);

    // ── 频繁变化值存入 ref，避免 virtuosoComponents 依赖频繁重建 ──
    const dataRef = useRef(data);
    dataRef.current = data;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    const currentMusicRef = useRef(currentMusic);
    currentMusicRef.current = currentMusic;

    const handleRowClickRef = useRef<typeof handleRowClick>(null!);
    const externalOnRowDoubleClickRef = useRef(externalOnRowDoubleClick);
    externalOnRowDoubleClickRef.current = externalOnRowDoubleClick;
    const doubleClickBehaviorRef = useRef(doubleClickBehavior);
    doubleClickBehaviorRef.current = doubleClickBehavior;
    const handleRowContextMenuRef = useRef<typeof handleRowContextMenu>(null!);

    // ── statusColumn ref（避免 memo/callback 依赖函数引用频繁重建） ──
    const statusColumnRef = useRef(statusColumn);
    statusColumnRef.current = statusColumn;
    const hasStatusColumn = !!statusColumn;

    // ── 多选拖拽状态 ──
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const activeDragIdRef = useRef(activeDragId);
    activeDragIdRef.current = activeDragId;

    // ── 构建列定义 ──
    const hideSet = useMemo(() => new Set(hideColumns ?? []), [hideColumns]);

    const columns = useMemo<InternalColumn[]>(() => {
        const cols: InternalColumn[] = [];

        if (!hideSet.has('index')) {
            cols.push({
                id: 'index',
                header: '#',
                width: 56,
                align: 'center',
                cellClassName: 'song-table__cell--index',
                render: (_item, index) => index + 1,
            });
        }

        // 标题列始终可见
        cols.push({
            id: 'title',
            header: t('media.title'),
            cellClassName: 'song-table__cell--title',
            render: (item) => item.title,
        });

        if (!hideSet.has('artist')) {
            cols.push({
                id: 'artist',
                header: t('media.artist'),
                width: '18%',
                render: (item) => item.artist,
            });
        }

        if (!hideSet.has('album')) {
            cols.push({
                id: 'album',
                header: t('media.album'),
                width: '16%',
                render: (item) => item.album ?? '',
            });
        }

        if (!hideSet.has('duration')) {
            cols.push({
                id: 'duration',
                header: t('media.duration'),
                width: 80,
                align: 'right',
                cellClassName: 'song-table__cell--duration',
                render: (item) => formatDuration(item.duration),
            });
        }

        if (!hideSet.has('platform')) {
            cols.push({
                id: 'platform',
                header: t('media.platform'),
                width: 88,
                render: (item) => (
                    <span className="song-table__platform-badge">{item.platform}</span>
                ),
            });
        }

        return cols;
    }, [hideSet, t]);

    // ── colgroup（控制列宽） ──
    const colGroup = useMemo(
        () => (
            <colgroup>
                {hasStatusColumn && (
                    <col key="__status" style={{ width: `${statusColumnWidth}px` }} />
                )}
                {columns.map((col) => (
                    <col
                        key={col.id}
                        style={
                            col.width != null
                                ? {
                                      width:
                                          typeof col.width === 'number'
                                              ? `${col.width}px`
                                              : col.width,
                                  }
                                : undefined
                        }
                    />
                ))}
            </colgroup>
        ),
        [columns, hasStatusColumn, statusColumnWidth],
    );

    // ── 外部回调 ref（避免 useCallback 依赖外部函数引用） ──
    const externalOnRowClickRef = useRef(externalOnRowClick);
    externalOnRowClickRef.current = externalOnRowClick;
    const externalOnRowContextMenuRef = useRef(externalOnRowContextMenu);
    externalOnRowContextMenuRef.current = externalOnRowContextMenu;
    const onDragSortEndRef = useRef(onDragSortEnd);
    onDragSortEndRef.current = onDragSortEnd;
    const loadMoreStatusRef = useRef(loadMoreStatus);
    loadMoreStatusRef.current = loadMoreStatus;
    const onLoadMoreRetryRef = useRef(onLoadMoreRetry);
    onLoadMoreRetryRef.current = onLoadMoreRetry;

    // ── 辅助：根据 selectedIds 从 data 中解析出选中项列表 ──
    const resolveSelectedItems = useCallback(
        (ids: Set<string>): IMusic.IMusicItemBase[] => dataRef.current.filter((d) => ids.has(d.id)),
        [],
    );
    const resolveSelectedItemsRef = useRef(resolveSelectedItems);
    resolveSelectedItemsRef.current = resolveSelectedItems;

    // ── 行点击选中逻辑 ──
    const handleRowClick = useCallback(
        (item: IMusic.IMusicItemBase, index: number, e: ReactMouseEvent) => {
            let nextIds: Set<string>;
            if (enableSelection) {
                const id = item.id;
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl+Click: toggle 单个
                    nextIds = new Set(selectedIdsRef.current);
                    if (nextIds.has(id)) {
                        nextIds.delete(id);
                    } else {
                        nextIds.add(id);
                    }
                    lastClickIndexRef.current = index;
                } else if (e.shiftKey && lastClickIndexRef.current >= 0) {
                    // Shift+Click: 范围选中
                    const start = Math.min(lastClickIndexRef.current, index);
                    const end = Math.max(lastClickIndexRef.current, index);
                    // Ctrl+Shift: 追加到现有选区；Shift 单独: 替换
                    nextIds =
                        e.ctrlKey || e.metaKey
                            ? new Set(selectedIdsRef.current)
                            : new Set<string>();
                    const currentData = dataRef.current;
                    for (let i = start; i <= end; i++) {
                        nextIds.add(currentData[i].id);
                    }
                } else {
                    // 普通点击: 单选
                    nextIds = new Set([id]);
                    lastClickIndexRef.current = index;
                }
            } else {
                nextIds = new Set([item.id]);
                lastClickIndexRef.current = index;
            }
            selectedIdsRef.current = nextIds;
            setSelectedIds(nextIds);
            externalOnRowClickRef.current?.(
                { item, index, selectedItems: resolveSelectedItems(nextIds) },
                e,
            );
        },
        [enableSelection, setSelectedIds, resolveSelectedItems],
    );
    handleRowClickRef.current = handleRowClick;

    // ── 右键选中 ──
    const handleRowContextMenu = useCallback(
        (item: IMusic.IMusicItemBase, index: number, e: ReactMouseEvent) => {
            let effectiveIds: Set<string>;
            if (selectedIdsRef.current.has(item.id)) {
                // 右键项已在选区内 → 保留多选
                effectiveIds = selectedIdsRef.current;
            } else {
                // 右键项不在选区内 → 替换选区为该项
                effectiveIds = new Set([item.id]);
                setSelectedIds(effectiveIds);
                lastClickIndexRef.current = index;
            }
            externalOnRowContextMenuRef.current?.(
                { item, index, selectedItems: resolveSelectedItems(effectiveIds) },
                e,
            );
        },
        [setSelectedIds, resolveSelectedItems],
    );
    handleRowContextMenuRef.current = handleRowContextMenu;

    // ── Ctrl+A 全选（tinykeys 绑定到容器 DOM） ──
    useEffect(() => {
        if (!containerEl || !enableSelection) return;

        return tinykeys(containerEl, {
            '$mod+a': (e) => {
                e.preventDefault();
                setSelectedIds(new Set(dataRef.current.map((d) => d.id)));
            },
        });
    }, [enableSelection, setSelectedIds, containerEl]);

    // ── DnD ──
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const sortableIds = useMemo(() => data.map((d) => d.id), [data]);

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const activeId = String(event.active.id);
            setActiveDragId(activeId);

            // 如果拖拽项不在选中集合中，先选中它
            if (enableSelection && !selectedIdsRef.current.has(activeId)) {
                setSelectedIds(new Set([activeId]));
            }
        },
        [enableSelection, setSelectedIds],
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveDragId(null);

        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const currentData = dataRef.current;
        const overIndex = currentData.findIndex((d) => d.id === over.id);
        if (overIndex === -1) return;

        // 收集被拖拽的项索引（选中集合或仅拖拽项）
        const draggedIds = selectedIdsRef.current.has(String(active.id))
            ? selectedIdsRef.current
            : new Set([String(active.id)]);

        const fromIndices = currentData
            .map((d, i) => (draggedIds.has(d.id) ? i : -1))
            .filter((i) => i !== -1)
            .sort((a, b) => a - b);

        if (fromIndices.length > 0) {
            onDragSortEndRef.current?.(fromIndices, overIndex);
        }
    }, []);

    const handleDragCancel = useCallback(() => {
        setActiveDragId(null);
    }, []);

    // 当前拖拽项信息（DragOverlay 使用）
    const activeDragItem = useMemo(() => {
        if (!activeDragId) return null;
        return data.find((d) => d.id === activeDragId) ?? null;
    }, [activeDragId, data]);

    // ── 加载更多 ──
    const handleEndReached = useCallback(() => {
        if (loadMoreStatusRef.current === RequestStatus.Pending) return;
        onLoadMore?.();
    }, [onLoadMore]);

    // ── Virtuoso: 表头 ──
    const fixedHeaderContent = useCallback(
        () => (
            <tr className="song-table__header-row">
                {hasStatusColumn && (
                    <th key="__status" className="song-table__header-cell">
                        {statusColumnHeader}
                    </th>
                )}
                {columns.map((col) => (
                    <th
                        key={col.id}
                        className={cn(
                            'song-table__header-cell',
                            col.align && `song-table__header-cell--${col.align}`,
                        )}
                    >
                        {col.header}
                    </th>
                ))}
            </tr>
        ),
        [columns, hasStatusColumn, statusColumnHeader],
    );

    // ── Virtuoso: 单元格内容 ──
    const itemContent = useCallback(
        (index: number, item: IMusic.IMusicItemBase) => (
            <>
                {statusColumnRef.current && (
                    <td key="__status" className="song-table__cell song-table__cell--status">
                        <div className="song-table__cell-content">
                            {statusColumnRef.current(item, index)}
                        </div>
                    </td>
                )}
                {columns.map((col) => (
                    <td
                        key={col.id}
                        className={cn(
                            'song-table__cell',
                            col.align && `song-table__cell--${col.align}`,
                            col.cellClassName,
                        )}
                    >
                        <div className="song-table__cell-content">{col.render(item, index)}</div>
                    </td>
                ))}
            </>
        ),
        [columns],
    );

    // ── Virtuoso: components（仅依赖稳定值，ref 读取最新状态） ──
    const virtuosoComponents = useMemo(() => {
        const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = (props) => (
            <table className="song-table__table" {...props}>
                {colGroup}
                {props.children}
            </table>
        );

        // 覆盖 react-virtuoso 默认的 sticky thead，让表头跟随内容滚动
        const TableHead = React.forwardRef<
            HTMLTableSectionElement,
            React.HTMLAttributes<HTMLTableSectionElement>
        >((props, ref) => (
            <thead ref={ref} {...props} style={{ ...props.style, position: 'relative' }} />
        ));
        TableHead.displayName = 'SongTableHead';

        const TableRow = (trProps: any) => {
            const index = trProps['data-item-index'] as number;
            const item = dataRef.current[index];
            if (!item) return <tr {...trProps} />;

            const isActive = showActiveIndicator
                ? isSameMedia(item, currentMusicRef.current)
                : false;
            const isSelected = selectedIdsRef.current.has(item.id);

            const onClick = (e: ReactMouseEvent) => handleRowClickRef.current(item, index, e);
            const onDblClick = (e: ReactMouseEvent) => {
                if (externalOnRowDoubleClickRef.current) {
                    const selectedItems = resolveSelectedItemsRef.current(selectedIdsRef.current);
                    externalOnRowDoubleClickRef.current({ item, index, selectedItems }, e);
                } else {
                    const behavior =
                        doubleClickBehaviorRef.current ??
                        appConfig.getConfigByKey('playMusic.clickMusicList');
                    if (behavior === 'replace') {
                        trackPlayer.playMusicWithReplaceQueue(dataRef.current, {
                            startItem: item,
                        });
                    } else {
                        trackPlayer.playMusic(item as IMusic.IMusicItem);
                    }
                }
            };
            const onCtxMenu = (e: ReactMouseEvent) =>
                handleRowContextMenuRef.current(item, index, e);

            if (enableDragSort) {
                // 多选拖拽中，被拖拽的其他选中项显示为 ghost
                const dragId = activeDragIdRef.current;
                const isDragGhost =
                    dragId != null &&
                    dragId !== item.id &&
                    selectedIdsRef.current.has(dragId) &&
                    isSelected;

                return (
                    <DraggableTableRow
                        {...trProps}
                        id={item.id}
                        isActive={isActive}
                        isSelected={isSelected}
                        isDragEnabled
                        isDragGhost={isDragGhost}
                        rowHeight={rowHeight}
                        onClick={onClick}
                        onDoubleClick={onDblClick}
                        onContextMenu={onCtxMenu}
                    />
                );
            }

            return (
                <tr
                    {...trProps}
                    className={cn(
                        'song-table__row',
                        isActive && 'is-active',
                        isSelected && 'is-selected',
                        trProps.className,
                    )}
                    style={{ ...trProps.style, height: rowHeight }}
                    onClick={onClick}
                    onDoubleClick={onDblClick}
                    onContextMenu={onCtxMenu}
                />
            );
        };

        return { Table, TableHead, TableRow };
    }, [colGroup, enableDragSort, rowHeight, showActiveIndicator]);

    const totalColumnCount = columns.length + (statusColumn ? 1 : 0);

    // ── 底部 Footer ──
    const FooterComponent = useMemo(() => {
        if (!enableLoadMore) return undefined;
        return function TableFoot() {
            return (
                <tfoot>
                    <tr>
                        <td colSpan={totalColumnCount}>
                            <ListFooter
                                status={loadMoreStatusRef.current ?? RequestStatus.Done}
                                onRetry={onLoadMoreRetryRef.current}
                            />
                        </td>
                    </tr>
                </tfoot>
            );
        };
    }, [enableLoadMore, totalColumnCount]);

    // ── 合并 virtuoso components（稳定引用） ──
    const finalComponents = useMemo(
        () => ({
            ...virtuosoComponents,
            ...(FooterComponent ? { TableFoot: FooterComponent } : {}),
        }),
        [virtuosoComponents, FooterComponent],
    );

    // ── 空态 / 加载态：直接透传 StatusPlaceholder ──
    if (data.length === 0 && requestStatus != null && requestStatus !== RequestStatus.Idle) {
        return (
            <StatusPlaceholder
                status={requestStatus}
                isEmpty={requestStatus === RequestStatus.Done}
                emptyTitle={t('media.no_songs')}
                onRetry={onRetry}
            />
        );
    }

    // ── 渲染虚拟表格 ──
    const table = (
        <div
            ref={setContainerEl}
            className={cn('song-table', className)}
            tabIndex={enableSelection ? 0 : undefined}
        >
            <TableVirtuoso
                ref={virtuosoRef}
                data={data}
                customScrollParent={scrollParent}
                useWindowScroll={!scrollParent}
                fixedHeaderContent={fixedHeaderContent}
                fixedItemHeight={rowHeight}
                increaseViewportBy={320}
                itemContent={itemContent}
                endReached={enableLoadMore && onLoadMore ? handleEndReached : undefined}
                components={finalComponents}
            />
        </div>
    );

    if (enableDragSort) {
        return (
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={DND_MODIFIERS}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <SortableContext items={sortableIds}>{table}</SortableContext>
                <DragOverlay dropAnimation={null}>
                    {activeDragItem && (
                        <DragOverlayContent
                            dragCount={selectedIds.has(activeDragId!) ? selectedIds.size : 1}
                        />
                    )}
                </DragOverlay>
            </DndContext>
        );
    }

    return table;
}

export default SongTable;
