import { useState, useRef, useCallback } from 'react';
import { RequestStatus } from '@common/constant';
import pluginManager from '@infra/pluginManager/renderer';

interface ITopListCache {
    status: RequestStatus;
    data: IMusic.IMusicSheetGroupItem[];
}

/**
 * useTopLists — 排行榜数据获取 hook
 *
 * 按插件 hash 缓存分组榜单数据，切换插件时复用已有数据，避免重复请求。
 */
export function useTopLists(pluginHash: string) {
    const cacheRef = useRef<Record<string, ITopListCache>>({});

    const [status, setStatus] = useState<RequestStatus>(() => {
        return cacheRef.current[pluginHash]?.status ?? RequestStatus.Idle;
    });
    const [data, setData] = useState<IMusic.IMusicSheetGroupItem[]>(() => {
        return cacheRef.current[pluginHash]?.data ?? [];
    });

    const fetch = useCallback(async () => {
        const cached = cacheRef.current[pluginHash];
        // 已有数据或正在加载中，不重复请求
        if (cached?.data?.length || cached?.status === RequestStatus.Pending) {
            setStatus(cached.status);
            setData(cached.data);
            return;
        }

        setStatus(RequestStatus.Pending);
        setData([]);
        cacheRef.current[pluginHash] = { status: RequestStatus.Pending, data: [] };

        try {
            const result = await pluginManager.callPluginMethod({
                hash: pluginHash,
                method: 'getTopLists',
                args: [],
            });
            const groupData = result ?? [];
            cacheRef.current[pluginHash] = { status: RequestStatus.Done, data: groupData };
            setStatus(RequestStatus.Done);
            setData(groupData);
        } catch {
            cacheRef.current[pluginHash] = { status: RequestStatus.Error, data: [] };
            setStatus(RequestStatus.Error);
            setData([]);
        }
    }, [pluginHash]);

    const retry = useCallback(() => {
        // 清除缓存后重试
        delete cacheRef.current[pluginHash];
        fetch();
    }, [pluginHash, fetch]);

    // 同步读取缓存（当 pluginHash 变化时）
    const syncFromCache = useCallback(() => {
        const cached = cacheRef.current[pluginHash];
        if (cached) {
            setStatus(cached.status);
            setData(cached.data);
        } else {
            setStatus(RequestStatus.Idle);
            setData([]);
        }
    }, [pluginHash]);

    return { status, data, fetch, retry, syncFromCache };
}
