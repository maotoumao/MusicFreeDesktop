/**
 * SheetResult — 搜索结果：歌单 Tab
 *
 * 使用 ui/MediaGrid 展示歌单卡片网格。
 * IMusicSheetItem 与 MediaGrid 的数据类型完全匹配。
 */

import { useCallback } from 'react';
import { useAtomValue } from 'jotai/react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { RequestStatus } from '@common/constant';
import { MediaGrid } from '../../../components/ui/MediaGrid';
import { musicSheetRoute } from '../../../routes';
import { searchResultsAtom, type SearchMediaType } from '../store';
import { useSearch } from '../useSearch';

interface SheetResultProps {
    pluginHash: string;
}

export function SheetResult({ pluginHash }: SheetResultProps) {
    const results = useAtomValue(searchResultsAtom);
    const type: SearchMediaType = 'sheet';
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

    const handleItemClick = useCallback(
        (item: IMusic.IMusicSheetItem) => {
            navigate(musicSheetRoute(item.platform, item.id), {
                state: { sheetItem: item },
            });
        },
        [navigate],
    );

    return (
        <MediaGrid
            data={data}
            onItemClick={handleItemClick}
            requestStatus={status}
            onRetry={handleRetry}
            enableLoadMore={!isEnd && status !== RequestStatus.Idle}
            loadMoreStatus={status === RequestStatus.Done ? RequestStatus.Idle : status}
            onLoadMore={handleLoadMore}
            onLoadMoreRetry={handleLoadMore}
            emptyTitle={t('search.empty_sheet')}
        />
    );
}
