import { useState, useMemo, useDeferredValue, useCallback, type MouseEvent } from 'react';
import { useParams, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Heart, FolderPlus } from 'lucide-react';
import { RequestStatus } from '@common/constant';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import musicSheet, { useIsSheetStarred } from '@infra/musicSheet/renderer';
import { MusicSheetHeader } from '../../components/ui/MusicSheetHeader';
import { SongTable, type RowInteractionDetail } from '../../components/business/SongTable';
import { FavoriteButton } from '../../components/business/FavoriteButton';
import { DownloadButton } from '../../components/business/DownloadButton';
import { SongToolbar } from '../../components/ui/SongToolbar';
import { ListFooter } from '../../components/ui/ListFooter';
import { Button } from '../../components/ui/Button';
import { showContextMenu } from '../../components/ui/ContextMenu/contextMenuManager';
import { showModal } from '../../components/ui/Modal/modalManager';
import { useSheetDetail } from './useSheetDetail';
import './index.scss';

/**
 * SheetPage — 远程歌单详情页
 *
 * 路由: /musicsheet/:platform/:id
 * state: { sheetItem: IMusic.IMusicSheetItem }
 */
export default function SheetPage() {
    const { platform, id } = useParams<{ platform: string; id: string }>();
    const location = useLocation();
    const { t } = useTranslation();

    // 从 route state 获取完整 item，fallback 到 URL params 构造最小对象
    const originalItem = useMemo<IMusic.IMusicSheetItem>(() => {
        const stateItem = (location.state as { sheetItem?: IMusic.IMusicSheetItem })?.sheetItem;
        return {
            ...stateItem,
            platform: platform ? decodeURIComponent(platform) : (stateItem?.platform ?? ''),
            id: id ? decodeURIComponent(id) : (stateItem?.id ?? ''),
            title: stateItem?.title ?? '',
        };
    }, [platform, id, location.state]);

    const { sheetItem, musicList, requestStatus, isEnd, loadMore, retry } =
        useSheetDetail(originalItem);

    // ── 本地搜索 ──
    const [searchValue, setSearchValue] = useState('');
    const deferredSearch = useDeferredValue(searchValue);

    const filteredList = useMemo(() => {
        const keyword = deferredSearch.trim().toLowerCase();
        if (!keyword) return musicList;
        return musicList.filter(
            (item) =>
                item.title.toLowerCase().includes(keyword) ||
                (item.artist ?? '').toLowerCase().includes(keyword) ||
                (item.album ?? '').toLowerCase().includes(keyword),
        );
    }, [musicList, deferredSearch]);

    // ── 操作回调 ──
    const handlePlayAll = useCallback(() => {
        if (filteredList.length === 0) return;
        trackPlayer.playMusicWithReplaceQueue(filteredList);
    }, [filteredList]);

    const handleRowContextMenu = useCallback(
        ({ selectedItems }: RowInteractionDetail, e: MouseEvent) => {
            showContextMenu(
                'MusicItemMenu',
                { x: e.clientX, y: e.clientY },
                {
                    musicItems: selectedItems as IMusic.IMusicItem[],
                },
            );
        },
        [],
    );

    const handleAddToSheet = useCallback(() => {
        if (musicList.length === 0) return;
        showModal('AddMusicToSheetModal', { musicItems: musicList });
    }, [musicList]);

    const isStarred = useIsSheetStarred(sheetItem);

    const handleToggleStar = useCallback(() => {
        if (isStarred) {
            musicSheet.unstarMusicSheet(sheetItem);
        } else {
            musicSheet.starMusicSheet(sheetItem);
        }
    }, [isStarred, sheetItem]);

    return (
        <div className="p-sheet">
            <MusicSheetHeader musicSheet={sheetItem} />

            <div className="p-sheet__toolbar">
                <SongToolbar
                    searchPlaceholder={t('playlist.sheet_search_placeholder')}
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    onPlayAll={handlePlayAll}
                    disabled={musicList.length === 0}
                >
                    <Button
                        variant="secondary"
                        size="md"
                        icon={<FolderPlus size={16} />}
                        onClick={handleAddToSheet}
                    >
                        {t('playlist.add_to_sheet_menu')}
                    </Button>
                    <Button
                        className="always-enabled"
                        variant="secondary"
                        size="md"
                        icon={
                            <Heart
                                size={16}
                                color={isStarred ? 'var(--color-favorite)' : 'currentColor'}
                                fill={isStarred ? 'var(--color-favorite)' : 'none'}
                            />
                        }
                        onClick={handleToggleStar}
                    >
                        {isStarred ? t('playlist.unstar') : t('playlist.star')}
                    </Button>
                </SongToolbar>
            </div>

            <SongTable
                data={filteredList}
                requestStatus={musicList.length > 0 ? RequestStatus.Done : requestStatus}
                onRetry={retry}
                enableLoadMore={!isEnd && musicList.length > 0}
                loadMoreStatus={requestStatus}
                onLoadMore={loadMore}
                onLoadMoreRetry={retry}
                enableSelection
                statusColumn={(item) => (
                    <>
                        <FavoriteButton musicItem={item} size="sm" />
                        <DownloadButton musicItem={item} size="sm" />
                    </>
                )}
                onRowContextMenu={handleRowContextMenu}
            />

            {isEnd && musicList.length > 0 && <ListFooter status={RequestStatus.Done} />}
        </div>
    );
}
