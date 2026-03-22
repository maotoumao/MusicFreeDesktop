import {
    useState,
    useMemo,
    useDeferredValue,
    useCallback,
    useEffect,
    type MouseEvent,
} from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Heart, ListMusic, FolderPlus } from 'lucide-react';
import { RequestStatus } from '@common/constant';
import { isSameMedia } from '@common/mediaKey';
import appConfig from '@infra/appConfig/renderer';
import musicSheet, {
    useCurrentMusicList,
    useIsLoadingSheet,
    useMusicSheetMeta,
} from '@infra/musicSheet/renderer';
import { DEFAULT_FAVORITE_SHEET_ID } from '@infra/musicSheet/common/constant';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { MusicSheetHeader } from '../../components/ui/MusicSheetHeader';
import { SongTable, type RowInteractionDetail } from '../../components/business/SongTable';
import { FavoriteButton } from '../../components/business/FavoriteButton';
import { DownloadButton } from '../../components/business/DownloadButton';
import { SongToolbar } from '../../components/ui/SongToolbar';
import { ListFooter } from '../../components/ui/ListFooter';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { Button } from '../../components/ui/Button';
import { showModal } from '../../components/ui/Modal/modalManager';
import { showContextMenu } from '../../components/ui/ContextMenu/contextMenuManager';
import './index.scss';

/**
 * LocalSheetPage — 本地歌单详情页
 *
 * 路由: /local-sheet/:id
 *
 * 功能：
 *   - MusicSheetHeader：封面 + 标题 + 描述 + 元信息
 *   - SongToolbar：播放全部 + 添加到歌单 + 搜索
 *   - SongTable：虚拟滚动表格，支持拖拽排序 + 多选 + 右键菜单
 *   - 收藏夹特殊处理：标题 i18n、Heart 占位图标
 *
 * 设计稿还原（像素级）：
 *   页面: pt --space-4, pb player-h + --space-5
 *   工具栏: mt --space-2
 */
export default function LocalSheetPage() {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();

    // ── 歌单元数据 ──
    const sheetMeta = useMusicSheetMeta(id);

    const isFavorite = id === DEFAULT_FAVORITE_SHEET_ID;

    // ── 歌曲列表 ──
    const musicList = useCurrentMusicList();
    const isLoading = useIsLoadingSheet();

    // ── 页内搜索 ──
    const [searchValue, setSearchValue] = useState('');
    const deferredSearchValue = useDeferredValue(searchValue);

    // ── 加载歌单详情 ──
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!id) return;
        let aborted = false;
        setLoadError(false);
        setSearchValue('');
        musicSheet.openSheet(id).catch(() => {
            if (!aborted) setLoadError(true);
        });
        return () => {
            aborted = true;
        };
    }, [id]);

    const filteredList = useMemo(() => {
        const raw = deferredSearchValue.trim();
        if (!raw) return musicList;
        const caseSensitive = appConfig.getConfigByKey('playMusic.caseSensitiveInSearch');
        const keyword = caseSensitive ? raw : raw.toLowerCase();
        const normalize = caseSensitive
            ? (s?: string) => s ?? ''
            : (s?: string) => (s ?? '').toLowerCase();
        return musicList.filter(
            (item) =>
                normalize(item.title).includes(keyword) ||
                normalize(item.artist).includes(keyword) ||
                normalize(item.album).includes(keyword),
        );
    }, [musicList, deferredSearchValue]);

    // ── 多选 ──
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 歌单/搜索变化时重置选中
    useEffect(() => {
        setSelectedIds(new Set());
    }, [id, deferredSearchValue]);

    // 搜索时禁用拖拽（过滤后的索引与原始数组不一致）
    const isSearching = deferredSearchValue.trim().length > 0;

    // ── 播放全部 ──
    const handlePlayAll = useCallback(() => {
        if (filteredList.length === 0) return;
        trackPlayer.playMusicWithReplaceQueue(filteredList, {
            fromSheetId: isSearching ? undefined : id,
        });
    }, [filteredList, id, isSearching]);

    // ── 添加到歌单 ──
    const handleAddToSheet = useCallback(() => {
        if (filteredList.length === 0) return;
        // slim 对象可安全传入：upsert 使用 COALESCE 保护已有 raw 数据
        showModal('AddMusicToSheetModal', {
            musicItems: filteredList as IMusic.IMusicItem[],
        });
    }, [filteredList]);

    // ── 双击播放（遵循全局配置） ──
    const handleRowDoubleClick = useCallback(
        ({ item }: RowInteractionDetail) => {
            const behavior = appConfig.getConfigByKey('playMusic.clickMusicList');
            if (behavior === 'replace') {
                if (isSearching) {
                    trackPlayer.playMusicWithReplaceQueue(filteredList, {
                        startItem: item,
                    });
                } else {
                    const list = musicSheet.getCurrentMusicList();
                    trackPlayer.playMusicWithReplaceQueue(list, {
                        startItem: item,
                        fromSheetId: id,
                    });
                }
            } else {
                trackPlayer.playMusic(item as IMusic.IMusicItem);
            }
        },
        [id, isSearching, filteredList],
    );

    // ── 右键菜单 ──
    const handleRowContextMenu = useCallback(
        ({ selectedItems }: RowInteractionDetail, e: MouseEvent) => {
            showContextMenu(
                'MusicItemMenu',
                { x: e.clientX, y: e.clientY },
                {
                    // slim 对象可安全传入：upsert 使用 COALESCE 保护已有 raw 数据
                    musicItems: selectedItems as IMusic.IMusicItem[],
                    sheetId: id,
                },
            );
        },
        [id],
    );

    // ── 拖拽排序 ──
    const handleDragSortEnd = useCallback(
        (fromIndices: number[], toIndex: number) => {
            if (!id || isSearching) return;

            const list = [...musicSheet.getCurrentMusicList()];
            const overItem = list[toIndex];
            // 提取被拖拽的项
            const draggedItems = fromIndices.map((i) => list[i]);
            // 从原数组中移除（倒序避免索引偏移）
            for (let i = fromIndices.length - 1; i >= 0; i--) {
                list.splice(fromIndices[i], 1);
            }
            // 在缩减后的数组中定位 over 元素的新位置
            const overNewIdx = list.findIndex((m) => isSameMedia(m, overItem));
            if (overNewIdx === -1) {
                // over 元素本身被拖拽（边界情况），退回到 clamped toIndex
                const insertAt = Math.min(toIndex, list.length);
                list.splice(insertAt, 0, ...draggedItems);
            } else {
                // 向下拖拽（被拖拽项部分在 over 之前）：插入到 over 之后
                // 向上拖拽（被拖拽项全部在 over 之后）：插入到 over 之前
                const allBelow = fromIndices.every((i) => i > toIndex);
                const insertAt = allBelow ? overNewIdx : overNewIdx + 1;
                list.splice(insertAt, 0, ...draggedItems);
            }

            musicSheet.updateMusicOrder(id, list);
        },
        [id, isSearching],
    );

    // ── 构造 MusicSheetHeader 所需数据 ──
    const headerSheet = useMemo((): IMusic.IMusicSheetItem => {
        const base = {
            id: id ?? '',
            platform: 'local',
            title: isFavorite ? t('media.default_favorite_sheet_name') : (sheetMeta?.title ?? ''),
            artwork: sheetMeta?.artwork ?? sheetMeta?.latestArtwork ?? undefined,
            description: sheetMeta?.description ?? undefined,
            worksNum: musicList.length,
        };
        return base;
    }, [sheetMeta, id, isFavorite, musicList.length, t]);

    // ── 状态判断 ──
    const requestStatus = loadError
        ? RequestStatus.Error
        : isLoading
          ? RequestStatus.Pending
          : RequestStatus.Done;

    const isEmpty = !isLoading && !loadError && musicList.length === 0;

    // ── 加载失败重试 ──
    const handleRetry = useCallback(() => {
        if (!id) return;
        setLoadError(false);
        musicSheet.openSheet(id).catch(() => setLoadError(true));
    }, [id]);

    return (
        <div className="p-local-sheet">
            {/* ── 页头 ── */}
            <MusicSheetHeader musicSheet={headerSheet} hideSourceBadge />

            {/* ── 工具栏（始终显示，避免切换歌单时闪烁） ── */}
            <div className="p-local-sheet__toolbar">
                <SongToolbar
                    searchPlaceholder={t('playlist.sheet_search_placeholder')}
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    onPlayAll={handlePlayAll}
                    disabled={isEmpty}
                >
                    <Button
                        variant="secondary"
                        size="md"
                        icon={<FolderPlus size={16} />}
                        onClick={handleAddToSheet}
                    >
                        {t('playlist.add_to_sheet_menu')}
                    </Button>
                </SongToolbar>
            </div>

            {/* ── 列表区 ── */}
            {isEmpty ? (
                <StatusPlaceholder
                    status={RequestStatus.Done}
                    isEmpty
                    emptyIcon={isFavorite ? Heart : ListMusic}
                    emptyTitle={t('playlist.empty_title')}
                    emptyDescription={t('playlist.empty_desc')}
                />
            ) : loadError ? (
                <StatusPlaceholder
                    status={RequestStatus.Error}
                    errorTitle={t('playlist.local_load_error')}
                    onRetry={handleRetry}
                />
            ) : (
                <>
                    <SongTable
                        data={filteredList}
                        requestStatus={requestStatus}
                        onRetry={handleRetry}
                        enableSelection
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        enableDragSort={!isSearching}
                        onDragSortEnd={handleDragSortEnd}
                        statusColumn={(item) => (
                            <>
                                <FavoriteButton musicItem={item} size="sm" />
                                <DownloadButton musicItem={item} size="sm" />
                            </>
                        )}
                        onRowDoubleClick={handleRowDoubleClick}
                        onRowContextMenu={handleRowContextMenu}
                    />

                    {requestStatus === RequestStatus.Done && filteredList.length > 0 && (
                        <ListFooter status={RequestStatus.Done} />
                    )}
                </>
            )}
        </div>
    );
}
