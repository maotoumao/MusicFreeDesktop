import { useState, useMemo, useDeferredValue, useCallback, type MouseEvent } from 'react';
import { useParams, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FolderPlus } from 'lucide-react';
import { RequestStatus } from '@common/constant';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { MusicSheetHeader } from '../../components/ui/MusicSheetHeader';
import { SongTable, type RowInteractionDetail } from '../../components/business/SongTable';
import { FavoriteButton } from '../../components/business/FavoriteButton';
import { DownloadButton } from '../../components/business/DownloadButton';
import { SongToolbar } from '../../components/ui/SongToolbar';
import { ListFooter } from '../../components/ui/ListFooter';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { Button } from '../../components/ui/Button';
import { showContextMenu } from '../../components/ui/ContextMenu/contextMenuManager';
import { showModal } from '../../components/ui/Modal/modalManager';
import { useAlbumDetail } from './useAlbumDetail';
import './index.scss';

/**
 * AlbumPage — 专辑详情页
 *
 * 路由: /album/:platform/:id
 * state: { albumItem: IAlbum.IAlbumItem }
 */
export default function AlbumPage() {
    const { platform, id } = useParams<{ platform: string; id: string }>();
    const location = useLocation();
    const { t } = useTranslation();

    const originalItem = useMemo<IAlbum.IAlbumItem>(() => {
        const stateItem = (location.state as { albumItem?: IAlbum.IAlbumItem })?.albumItem;
        return {
            ...stateItem,
            platform: platform ? decodeURIComponent(platform) : (stateItem?.platform ?? ''),
            id: id ? decodeURIComponent(id) : (stateItem?.id ?? ''),
            title: stateItem?.title ?? '',
        };
    }, [platform, id, location.state]);

    const { albumItem, musicList, requestStatus, isEnd, loadMore, retry } =
        useAlbumDetail(originalItem);

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

    // ── 首次加载占位 ──
    const isFirstLoading = requestStatus === RequestStatus.Pending && musicList.length === 0;
    const isFirstError = requestStatus === RequestStatus.Error && musicList.length === 0;

    if (isFirstLoading) {
        return (
            <div className="p-album">
                <StatusPlaceholder status={RequestStatus.Pending} />
            </div>
        );
    }

    if (isFirstError) {
        return (
            <div className="p-album">
                <StatusPlaceholder
                    status={RequestStatus.Error}
                    errorTitle={t('media.album_load_error')}
                    onRetry={retry}
                />
            </div>
        );
    }

    // IAlbumItem extends IMusicSheetItem，可直接传给 MusicSheetHeader
    return (
        <div className="p-album">
            <MusicSheetHeader musicSheet={albumItem} />

            <div className="p-album__toolbar">
                <SongToolbar
                    searchPlaceholder={t('media.album_search_placeholder')}
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
