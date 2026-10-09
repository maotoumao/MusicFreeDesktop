import { useState, useRef, useCallback, useEffect } from 'react';
import { RequestStatus } from '@common/constant';
import pluginManager from '@infra/pluginManager/renderer';

/**
 * useRecommendSheets — 获取推荐歌单列表 hook
 *
 * 支持分页加载。当 tag 变更时，自动重置并加载首页。
 */
export function useRecommendSheets(pluginHash: string, tag: IMedia.IUnique | null) {
    const [sheets, setSheets] = useState<IMusic.IMusicSheetItem[]>([]);
    const [requestStatus, setRequestStatus] = useState<RequestStatus>(RequestStatus.Idle);
    const [isEnd, setIsEnd] = useState(false);

    const pageRef = useRef(1);
    const pendingRef = useRef(false);
    const tagIdRef = useRef<string>('');

    const fetchPage = useCallback(
        async (fetchTag: IMedia.IUnique, page: number, isFirstPage: boolean) => {
            if (pendingRef.current) return;
            pendingRef.current = true;
            setRequestStatus(RequestStatus.Pending);

            try {
                const result = await pluginManager.callPluginMethod({
                    hash: pluginHash,
                    method: 'getRecommendSheetsByTag',
                    args: [fetchTag, page],
                });

                // 检查 tag 是否已经变化
                if (tagIdRef.current !== fetchTag.id) return;

                const resData = result?.data ?? [];
                const resIsEnd = result?.isEnd ?? true;

                setSheets((prev) => (isFirstPage ? resData : [...prev, ...resData]));
                setIsEnd(resIsEnd);
                setRequestStatus(RequestStatus.Done);
                pageRef.current = page;
            } catch {
                if (tagIdRef.current !== fetchTag.id) return;
                setRequestStatus(RequestStatus.Error);
            } finally {
                pendingRef.current = false;
            }
        },
        [pluginHash],
    );

    // tag 变化时重置并加载首页
    useEffect(() => {
        if (!tag) return;
        tagIdRef.current = tag.id;
        pendingRef.current = false;
        setSheets([]);
        setIsEnd(false);
        pageRef.current = 1;
        fetchPage(tag, 1, true);
    }, [tag?.id, pluginHash]);

    const loadMore = useCallback(() => {
        if (!tag || isEnd || pendingRef.current) return;
        fetchPage(tag, pageRef.current + 1, false);
    }, [tag, isEnd, fetchPage]);

    const retry = useCallback(() => {
        if (!tag) return;
        const isFirstPage = pageRef.current <= 1 && sheets.length === 0;
        fetchPage(tag, isFirstPage ? 1 : pageRef.current + 1, isFirstPage);
    }, [tag, sheets.length, fetchPage]);

    return { sheets, requestStatus, isEnd, loadMore, retry };
}
