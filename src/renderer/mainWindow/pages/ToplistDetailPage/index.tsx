/**
 * ToplistDetailPage — 排行榜详情页
 *
 * 路由: /toplist-detail/:platform
 * state: { topListItem: IMusic.IMusicSheetItem }
 *
 * 展示榜单封面信息 + 歌曲列表，支持分页加载。
 */

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
import { useTopListDetail } from './useTopListDetail';
import './index.scss';

export default function ToplistDetailPage() {
    const { t } = useTranslation();
    const { platform: rawPlatform } = useParams<{ platform: string }>();
    const platform = rawPlatform ? decodeURIComponent(rawPlatform) : '';
    const location = useLocation();

    const topListItem = useMemo<IMusic.IMusicSheetItem | null>(() => {
        const stateItem = (location.state as { topListItem?: IMusic.IMusicSheetItem })?.topListItem;
        if (!stateItem) return null;
        return {
            ...stateItem,
            platform: platform || stateItem.platform,
        };
    }, [platform, location.state]);

    const { sheetItem, musicList, requestStatus, isEnd, loadMore, retry } = useTopListDetail(
        topListItem,
        platform,
    );

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

    if (!topListItem) {
        return (
            <div className="p-toplist-detail">
                <StatusPlaceholder
                    status={RequestStatus.Error}
                    errorTitle={t('toplist.missing_info')}
                    errorDescription={t('toplist.missing_info_desc')}
                />
            </div>
        );
    }

    return (
        <div className="p-toplist-detail">
            <MusicSheetHeader musicSheet={sheetItem} />

            <div className="p-toplist-detail__toolbar">
                <SongToolbar
                    searchPlaceholder={t('toplist.search_placeholder')}
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
