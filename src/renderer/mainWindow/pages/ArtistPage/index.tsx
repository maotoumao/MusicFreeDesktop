import { useState, useMemo, useCallback, type MouseEvent } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { RequestStatus } from '@common/constant';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { SongTable, type RowInteractionDetail } from '../../components/business/SongTable';
import { FavoriteButton } from '../../components/business/FavoriteButton';
import { DownloadButton } from '../../components/business/DownloadButton';
import { SongToolbar } from '../../components/ui/SongToolbar';
import { MediaGrid } from '../../components/ui/MediaGrid';
import { TabBar, type TabItem } from '../../components/ui/TabBar';
import { ListFooter } from '../../components/ui/ListFooter';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { showContextMenu } from '../../components/ui/ContextMenu/contextMenuManager';
import { albumRoute } from '../../routes';
import { ArtistHeader } from './ArtistHeader';
import { useArtistWorks } from './useArtistWorks';
import './index.scss';

/**
 * ArtistPage — 作者详情页
 *
 * 路由: /artist/:platform/:id
 * state: { artistItem: IArtist.IArtistItem }
 */
export default function ArtistPage() {
    const { platform, id } = useParams<{ platform: string; id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const tabItems = useMemo<TabItem[]>(
        () => [
            { key: 'music', label: t('media.type_music') },
            { key: 'album', label: t('media.type_album') },
        ],
        [t],
    );

    const originalItem = useMemo<IArtist.IArtistItem>(() => {
        const stateItem = (location.state as { artistItem?: IArtist.IArtistItem })?.artistItem;
        return {
            name: stateItem?.name ?? '',
            avatar: stateItem?.avatar ?? '',
            ...stateItem,
            platform: platform ? decodeURIComponent(platform) : (stateItem?.platform ?? ''),
            id: id ? decodeURIComponent(id) : (stateItem?.id ?? ''),
        };
    }, [platform, id, location.state]);

    // ── Tab 切换 ──
    const [activeTab, setActiveTab] = useState<IArtist.ArtistMediaType>('music');

    // ── 两个 Tab 的 hook 都提到 Page 层，切换时不丢失数据 ──
    const musicWorks = useArtistWorks(originalItem, 'music');
    const albumWorks = useArtistWorks(originalItem, 'album');

    const activeWorks = activeTab === 'music' ? musicWorks : albumWorks;

    // ── 操作回调 ──
    const handlePlayAll = useCallback(() => {
        if (activeTab !== 'music') return;
        const list = musicWorks.data as IMusic.IMusicItem[];
        if (list.length === 0) return;
        trackPlayer.playMusicWithReplaceQueue(list);
    }, [activeTab, musicWorks.data]);

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

    const handleAlbumClick = useCallback(
        (item: IMusic.IMusicSheetItem) => {
            const albumItem = item as IAlbum.IAlbumItem;
            navigate(albumRoute(albumItem.platform, albumItem.id), {
                state: { albumItem },
            });
        },
        [navigate],
    );

    const handleTabChange = (key: string) => {
        setActiveTab(key as IArtist.ArtistMediaType);
    };

    // ── 首次加载占位 ──
    const isFirstLoading =
        activeWorks.requestStatus === RequestStatus.Pending && activeWorks.data.length === 0;
    const isFirstError =
        activeWorks.requestStatus === RequestStatus.Error && activeWorks.data.length === 0;

    return (
        <div className="p-artist">
            <ArtistHeader artist={originalItem} />

            <div className="p-artist__tabs">
                <TabBar items={tabItems} activeKey={activeTab} onChange={handleTabChange} />
            </div>

            {/* ── 音乐 Tab ── */}
            {activeTab === 'music' && (
                <>
                    {isFirstLoading ? (
                        <StatusPlaceholder status={RequestStatus.Pending} />
                    ) : isFirstError ? (
                        <StatusPlaceholder
                            status={RequestStatus.Error}
                            errorTitle={t('media.artist_load_error')}
                            onRetry={musicWorks.retry}
                        />
                    ) : (
                        <>
                            <SongToolbar
                                onPlayAll={handlePlayAll}
                                disabled={musicWorks.data.length === 0}
                            />
                            <SongTable
                                data={musicWorks.data as IMusic.IMusicItem[]}
                                requestStatus={
                                    musicWorks.data.length > 0
                                        ? RequestStatus.Done
                                        : musicWorks.requestStatus
                                }
                                onRetry={musicWorks.retry}
                                enableLoadMore={!musicWorks.isEnd && musicWorks.data.length > 0}
                                loadMoreStatus={musicWorks.requestStatus}
                                onLoadMore={musicWorks.loadMore}
                                onLoadMoreRetry={musicWorks.retry}
                                statusColumn={(item) => (
                                    <>
                                        <FavoriteButton musicItem={item} size="sm" />
                                        <DownloadButton musicItem={item} size="sm" />
                                    </>
                                )}
                                onRowContextMenu={handleRowContextMenu}
                            />
                            {musicWorks.isEnd && musicWorks.data.length > 0 && (
                                <ListFooter status={RequestStatus.Done} />
                            )}
                        </>
                    )}
                </>
            )}

            {/* ── 专辑 Tab ── */}
            {activeTab === 'album' && (
                <div className="p-artist__album-grid">
                    <MediaGrid
                        data={albumWorks.data as IAlbum.IAlbumItem[]}
                        requestStatus={albumWorks.requestStatus}
                        onRetry={albumWorks.retry}
                        onItemClick={handleAlbumClick}
                        enableLoadMore={!albumWorks.isEnd && albumWorks.data.length > 0}
                        loadMoreStatus={albumWorks.requestStatus}
                        onLoadMore={albumWorks.loadMore}
                        onLoadMoreRetry={albumWorks.retry}
                        emptyTitle={t('media.artist_empty_albums')}
                    />
                    {albumWorks.isEnd && albumWorks.data.length > 0 && (
                        <ListFooter status={RequestStatus.Done} />
                    )}
                </div>
            )}
        </div>
    );
}
