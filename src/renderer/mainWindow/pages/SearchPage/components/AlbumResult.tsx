/**
 * AlbumResult — 搜索结果：专辑 Tab
 *
 * 使用 ui/MediaGrid 展示专辑卡片网格。
 * IAlbumItem 与 IMusicSheetItem 结构兼容，直接传入 MediaGrid。
 */

import { useCallback } from 'react';
import { useAtomValue } from 'jotai/react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { RequestStatus } from '@common/constant';
import { MediaGrid } from '../../../components/ui/MediaGrid';
import { albumRoute } from '../../../routes';
import { searchResultsAtom, type SearchMediaType } from '../store';
import { useSearch } from '../useSearch';

interface AlbumResultProps {
    pluginHash: string;
}

export function AlbumResult({ pluginHash }: AlbumResultProps) {
    const results = useAtomValue(searchResultsAtom);
    const type: SearchMediaType = 'album';
    const record = results[type][pluginHash];
    const { search, loadMore } = useSearch();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const data = record?.data ?? [];
    const status = record?.status ?? RequestStatus.Idle;
    const isEnd = record?.isEnd ?? false;

    const handleRetry = useCallback(() => {
        if (record?.query) {
            search(record.query, type, pluginHash);
        }
    }, [search, record?.query, pluginHash]);

    const handleLoadMore = useCallback(() => {
        loadMore(type, pluginHash);
    }, [loadMore, pluginHash]);

    // IAlbumItem extends IMusicSheetItem — direct assignment is safe
    const gridData = data as IMusic.IMusicSheetItem[];

    const handleItemClick = useCallback(
        (item: IMusic.IMusicSheetItem) => {
            const albumItem = item as IAlbum.IAlbumItem;
            navigate(albumRoute(albumItem.platform, albumItem.id), {
                state: { albumItem },
            });
        },
        [navigate],
    );

    return (
        <MediaGrid
            data={gridData}
            onItemClick={handleItemClick}
            requestStatus={status}
            onRetry={handleRetry}
            enableLoadMore={!isEnd && status !== RequestStatus.Idle}
            loadMoreStatus={status === RequestStatus.Done ? RequestStatus.Idle : status}
            onLoadMore={handleLoadMore}
            onLoadMoreRetry={handleLoadMore}
            emptyTitle={t('search.empty_album')}
        />
    );
}
