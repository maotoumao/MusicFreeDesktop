import { useState, useRef, useCallback, useEffect } from 'react';
import { RequestStatus } from '@common/constant';
import { compositeKey } from '@common/mediaKey';
import pluginManager from '@infra/pluginManager/renderer';

/**
 * useArtistWorks — 作者作品 hook
 *
 * 按 type（music / album）分页加载作者的作品列表。
 * 每个 type 独立管理分页状态。
 */
export function useArtistWorks(originalItem: IArtist.IArtistItem, type: IArtist.ArtistMediaType) {
    const [data, setData] = useState<(IMusic.IMusicItem | IAlbum.IAlbumItem)[]>([]);
    const [requestStatus, setRequestStatus] = useState<RequestStatus>(RequestStatus.Idle);
    const [isEnd, setIsEnd] = useState(false);

    const pageRef = useRef(1);
    const pendingRef = useRef(false);
    const itemKeyRef = useRef(`${compositeKey(originalItem.platform, originalItem.id)}:${type}`);

    const fetchPage = useCallback(
        async (
            item: IArtist.IArtistItem,
            page: number,
            mediaType: IArtist.ArtistMediaType,
            isFirstPage: boolean,
        ) => {
            if (pendingRef.current) return;
            pendingRef.current = true;
            setRequestStatus(RequestStatus.Pending);

            const key = `${compositeKey(item.platform, item.id)}:${mediaType}`;

            try {
                const result = await pluginManager.callPluginMethod({
                    platform: item.platform,
                    method: 'getArtistWorks',
                    args: [item, page, mediaType],
                });

                if (itemKeyRef.current !== key) return;

                const resData = result?.data ?? [];
                const resIsEnd = result?.isEnd ?? true;

                setData((prev) => (isFirstPage ? resData : [...prev, ...resData]));
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
        itemKeyRef.current = `${compositeKey(originalItem.platform, originalItem.id)}:${type}`;
        pendingRef.current = false;
        setData([]);
        setIsEnd(false);
        pageRef.current = 1;
        fetchPage(originalItem, 1, type, true);
    }, [originalItem.platform, originalItem.id, type, fetchPage]);

    const loadMore = useCallback(() => {
        if (isEnd || pendingRef.current) return;
        fetchPage(originalItem, pageRef.current + 1, type, false);
    }, [isEnd, originalItem, type, fetchPage]);

    const retry = useCallback(() => {
        const isFirstPage = pageRef.current <= 1 && data.length === 0;
        fetchPage(originalItem, isFirstPage ? 1 : pageRef.current + 1, type, isFirstPage);
    }, [originalItem, type, data.length, fetchPage]);

    return { data, requestStatus, isEnd, loadMore, retry };
}
