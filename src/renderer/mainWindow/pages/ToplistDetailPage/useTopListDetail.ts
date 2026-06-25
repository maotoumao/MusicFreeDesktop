import { useState, useRef, useCallback, useEffect } from 'react';
import { RequestStatus } from '@common/constant';
import pluginManager from '@infra/pluginManager/renderer';

/**
 * useTopListDetail — 排行榜详情分页加载 hook
 *
 * 加载指定榜单的歌曲列表，支持分页。
 * 首次 mount 立即触发第一页加载。
 */
export function useTopListDetail(topListItem: IMusic.IMusicSheetItem | null, platform: string) {
    const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem>(
        topListItem ?? { id: '', platform, title: '' },
    );
    const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>([]);
    const [requestStatus, setRequestStatus] = useState<RequestStatus>(RequestStatus.Idle);
    const [isEnd, setIsEnd] = useState(false);

    const pageRef = useRef(1);
    const pendingRef = useRef(false);

    const fetchPage = useCallback(
        async (page: number, isFirstPage: boolean) => {
            if (!topListItem || pendingRef.current) return;
            pendingRef.current = true;
            setRequestStatus(RequestStatus.Pending);

            try {
                const result = await pluginManager.callPluginMethod({
                    platform,
                    method: 'getTopListDetail',
                    args: [topListItem, page],
                });

                const resMusicList = result?.musicList ?? [];
                const resIsEnd = result?.isEnd ?? true;

                if (result?.topListItem) {
                    setSheetItem((prev) => ({ ...prev, ...result.topListItem }));
                }

                setMusicList((prev) => (isFirstPage ? resMusicList : [...prev, ...resMusicList]));
                setIsEnd(resIsEnd);
                setRequestStatus(RequestStatus.Done);
                pageRef.current = page;
            } catch {
                setRequestStatus(RequestStatus.Error);
            } finally {
                pendingRef.current = false;
            }
        },
        [topListItem, platform],
    );

    // 初始加载
    useEffect(() => {
        if (topListItem) {
            pageRef.current = 1;
            pendingRef.current = false;
            setMusicList([]);
            setIsEnd(false);
            fetchPage(1, true);
        }
    }, [topListItem?.id, platform]);

    const loadMore = useCallback(() => {
        if (isEnd || pendingRef.current) return;
        fetchPage(pageRef.current + 1, false);
    }, [isEnd, fetchPage]);

    const retry = useCallback(() => {
        const isFirstPage = pageRef.current <= 1 && musicList.length === 0;
        fetchPage(isFirstPage ? 1 : pageRef.current + 1, isFirstPage);
    }, [musicList.length, fetchPage]);

    return { sheetItem, musicList, requestStatus, isEnd, loadMore, retry };
}
