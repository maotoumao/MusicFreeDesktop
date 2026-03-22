import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { RequestStatus } from '@common/constant';
import { MediaGrid } from '../../components/ui/MediaGrid';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { musicSheetRoute } from '../../routes';
import { TagFilter, DEFAULT_TAG } from './TagFilter';
import { useRecommendTags } from './useRecommendTags';
import { useRecommendSheets } from './useRecommendSheets';

interface RecommendSheetsBodyProps {
    pluginHash: string;
}

/**
 * RecommendSheetsBody — 单个插件的推荐歌单内容
 *
 * 标签筛选栏 + MediaGrid 歌单卡片网格 + 分页加载
 */
export function RecommendSheetsBody({ pluginHash }: RecommendSheetsBodyProps) {
    const { t } = useTranslation();
    const { tags, status: tagsStatus } = useRecommendTags(pluginHash);
    const [selectedTag, setSelectedTag] = useState<IMedia.IUnique>(DEFAULT_TAG);
    const navigate = useNavigate();

    // 插件切换时重置标签选择
    useEffect(() => {
        setSelectedTag(DEFAULT_TAG);
    }, [pluginHash]);

    const { sheets, requestStatus, isEnd, loadMore, retry } = useRecommendSheets(
        pluginHash,
        selectedTag,
    );

    const handleTagChange = useCallback((tag: IMedia.IUnique) => {
        setSelectedTag(tag);
    }, []);

    const handleItemClick = useCallback(
        (item: IMusic.IMusicSheetItem) => {
            navigate(musicSheetRoute(item.platform, item.id), {
                state: { sheetItem: item },
            });
        },
        [navigate],
    );

    // 标签加载中
    if (tagsStatus === RequestStatus.Pending && !tags) {
        return <StatusPlaceholder status={RequestStatus.Pending} />;
    }

    return (
        <div className="p-recommend-sheets__body">
            <TagFilter tags={tags} selectedTag={selectedTag} onTagChange={handleTagChange} />

            <MediaGrid
                data={sheets}
                requestStatus={requestStatus}
                onRetry={retry}
                onItemClick={handleItemClick}
                enableLoadMore={!isEnd && sheets.length > 0}
                loadMoreStatus={requestStatus}
                onLoadMore={loadMore}
                onLoadMoreRetry={retry}
                emptyTitle={t('playlist.recommend_empty')}
            />
        </div>
    );
}
