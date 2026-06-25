/**
 * MusicResult — 搜索结果：音乐 Tab
 *
 * 使用 business/SongTable 展示音乐搜索结果，
 * 支持加载更多与状态占位。
 */

import { useCallback } from 'react';
import { useAtomValue } from 'jotai/react';
import { RequestStatus } from '@common/constant';
import { SongTable } from '../../../components/business/SongTable';
import { FavoriteButton } from '../../../components/business/FavoriteButton';
import { DownloadButton } from '../../../components/business/DownloadButton';
import { searchResultsAtom, type SearchMediaType } from '../store';
import { useSearch } from '../useSearch';
import { showContextMenu } from '@renderer/mainWindow/components/ui/ContextMenu/contextMenuManager';

interface MusicResultProps {
    pluginHash: string;
}

export function MusicResult({ pluginHash }: MusicResultProps) {
    const results = useAtomValue(searchResultsAtom);
    const type: SearchMediaType = 'music';
    const record = results[type][pluginHash];
    const { search, loadMore } = useSearch();

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

    return (
        <SongTable
            data={data}
            requestStatus={status}
            statusColumn={(item) => (
                <>
                    <FavoriteButton musicItem={item} size="sm" />
                    <DownloadButton musicItem={item} size="sm" />
                </>
            )}
            doubleClickBehavior="normal"
            onRowContextMenu={({ selectedItems }, e) => {
                showContextMenu(
                    'MusicItemMenu',
                    {
                        x: e.clientX,
                        y: e.clientY,
                    },
                    {
                        musicItems: selectedItems as IMusic.IMusicItem[],
                    },
                );
            }}
            onRetry={handleRetry}
            enableLoadMore={!isEnd && status !== RequestStatus.Idle}
            loadMoreStatus={status === RequestStatus.Done ? RequestStatus.Idle : status}
            onLoadMore={handleLoadMore}
            onLoadMoreRetry={handleLoadMore}
        />
    );
}
