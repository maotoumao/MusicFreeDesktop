import { useState, useRef, useCallback, useEffect } from 'react';
import { RequestStatus } from '@common/constant';
import { compositeKey } from '@common/mediaKey';
import pluginManager from '@infra/pluginManager/renderer';

/**
 * useSheetDetail — 远程歌单详情 hook
 *
 * 分页加载歌单内歌曲列表，自动合并插件返回的歌单元数据。
 * 首次 mount 立即触发第一页加载。
 */
export function usePlaylistDetail(originalItem: IMusic.IPlaylistItem) {
    const [playlistItem, setPlaylistItem] = useState<IMusic.IPlaylistItem>(originalItem);
    const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>([]);
    const [requestStatus, setRequestStatus] = useState<RequestStatus>(RequestStatus.Idle);
    const [isEnd, setIsEnd] = useState(false);

    const pageRef = useRef(1);
    const pendingRef = useRef(false);
    const itemKeyRef = useRef(compositeKey(originalItem.platform, originalItem.id));

    const fetchPage = useCallback(
        async (item: IMusic.IPlaylistItem, page: number, isFirstPage: boolean) => {
            if (pendingRef.current) return;
            pendingRef.current = true;
            setRequestStatus(RequestStatus.Pending);

            const key = compositeKey(item.platform, item.id);

            try {
                const result = await pluginManager.callPluginMethod({
                    platform: item.platform,
                    method: 'getPlaylistInfo',
                    args: [item, page],
                });

                if (itemKeyRef.current !== key) return;

                const resMusicList = result?.musicList ?? [];
                const resIsEnd = result?.isEnd ?? true;

                if (result?.playlistItem) {
                    setPlaylistItem((prev) => ({ ...prev, ...result.playlistItem }));
                }

                setMusicList((prev) => (isFirstPage ? resMusicList : [...prev, ...resMusicList]));
                setIsEnd(resIsEnd);
                setRequestStatus(RequestStatus.Done);
                pageRef.current = page;
                pendingRef.current = false;
            } catch {
                if (itemKeyRef.current !== key) return;
                setRequestStatus(RequestStatus.Error);
                pendingRef.current = false;
            }
        },
        [],
    );

    useEffect(() => {
        itemKeyRef.current = compositeKey(originalItem.platform, originalItem.id);
        pendingRef.current = false;
        setPlaylistItem(originalItem);
        setMusicList([]);
        setIsEnd(false);
        pageRef.current = 1;
        fetchPage(originalItem, 1, true);
    }, [originalItem.platform, originalItem.id, fetchPage]);

    const loadMore = useCallback(() => {
        if (isEnd || pendingRef.current) return;
        fetchPage(playlistItem, pageRef.current + 1, false);
    }, [isEnd, playlistItem, fetchPage]);

    const retry = useCallback(() => {
        const isFirstPage = pageRef.current <= 1 && musicList.length === 0;
        fetchPage(playlistItem, isFirstPage ? 1 : pageRef.current + 1, isFirstPage);
    }, [playlistItem, musicList.length, fetchPage]);

    return { sheetItem: playlistItem, musicList, requestStatus, isEnd, loadMore, retry };
}
