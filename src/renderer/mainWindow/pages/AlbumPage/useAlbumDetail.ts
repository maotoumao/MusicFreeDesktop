import { useState, useRef, useCallback, useEffect } from 'react';
import { RequestStatus } from '@common/constant';
import { compositeKey } from '@common/mediaKey';
import pluginManager from '@infra/pluginManager/renderer';

/**
 * useAlbumDetail — 专辑详情 hook
 *
 * 分页加载专辑内歌曲列表，自动合并插件返回的 albumItem 元数据。
 * 首次 mount 立即触发第一页加载。
 */
export function useAlbumDetail(originalItem: IAlbum.IAlbumItem) {
    const [albumItem, setAlbumItem] = useState<IAlbum.IAlbumItem>(originalItem);
    const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>([]);
    const [requestStatus, setRequestStatus] = useState<RequestStatus>(RequestStatus.Idle);
    const [isEnd, setIsEnd] = useState(false);

    const pageRef = useRef(1);
    const pendingRef = useRef(false);
    const itemKeyRef = useRef(compositeKey(originalItem.platform, originalItem.id));

    const fetchPage = useCallback(
        async (item: IAlbum.IAlbumItem, page: number, isFirstPage: boolean) => {
            if (pendingRef.current) return;
            pendingRef.current = true;
            setRequestStatus(RequestStatus.Pending);

            const key = compositeKey(item.platform, item.id);

            try {
                const result = await pluginManager.callPluginMethod({
                    platform: item.platform,
                    method: 'getAlbumInfo',
                    args: [item, page],
                });

                if (itemKeyRef.current !== key) return;

                const resMusicList = result?.musicList ?? [];
                const resIsEnd = result?.isEnd ?? true;

                if (result?.albumItem) {
                    setAlbumItem((prev) => ({ ...prev, ...result.albumItem }));
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
        setAlbumItem(originalItem);
        setMusicList([]);
        setIsEnd(false);
        pageRef.current = 1;
        fetchPage(originalItem, 1, true);
    }, [originalItem.platform, originalItem.id, fetchPage]);

    const loadMore = useCallback(() => {
        if (isEnd || pendingRef.current) return;
        fetchPage(albumItem, pageRef.current + 1, false);
    }, [isEnd, albumItem, fetchPage]);

    const retry = useCallback(() => {
        const isFirstPage = pageRef.current <= 1 && musicList.length === 0;
        fetchPage(albumItem, isFirstPage ? 1 : pageRef.current + 1, isFirstPage);
    }, [albumItem, musicList.length, fetchPage]);

    return { albumItem, musicList, requestStatus, isEnd, loadMore, retry };
}
