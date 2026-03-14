import { useState, useCallback, useEffect } from 'react';
import { RequestStatus } from '@common/constant';
import pluginManager from '@infra/pluginManager/renderer';

/**
 * useRecommendTags — 获取热门歌单标签 hook
 *
 * 调用插件 getRecommendSheetTags，缓存按 pluginHash 隔离。
 */
export function useRecommendTags(pluginHash: string) {
    const [tags, setTags] = useState<IPlugin.IGetRecommendSheetTagsResult | null>(null);
    const [status, setStatus] = useState<RequestStatus>(RequestStatus.Idle);

    const fetch = useCallback(async () => {
        setStatus(RequestStatus.Pending);
        try {
            const result = await pluginManager.callPluginMethod({
                hash: pluginHash,
                method: 'getRecommendSheetTags',
                args: [],
            });
            setTags(result ?? { pinned: [], data: [] });
            setStatus(RequestStatus.Done);
        } catch {
            // 标签加载失败时回退为空标签列表，不阻塞歌单加载
            setTags({ pinned: [], data: [] });
            setStatus(RequestStatus.Done);
        }
    }, [pluginHash]);

    useEffect(() => {
        setTags(null);
        setStatus(RequestStatus.Idle);
        fetch();
    }, [pluginHash]);

    return { tags, status };
}
