/**
 * useSearch — 搜索页核心 Hook
 *
 * 提供：
 * - search(query, type, pluginHash)  首次搜索
 * - loadMore(type, pluginHash)       加载更多
 * - 自动处理：首页数据为空但未结束时自动拉取下一页
 *
 * 防腐设计：
 * - fetchPage 写入前检查 store 中的 query 是否仍匹配（C1/C2 防 stale 写入）
 * - autoContinue 仅追踪本轮新增数据量而非累积量（M1 修复）
 */

import { useCallback, useRef } from 'react';
import { RequestStatus } from '@common/constant';
import pluginManager from '@infra/pluginManager/renderer';
import { type SearchMediaType, getPluginResult, setPluginResult } from './store';

/** 最大自动续页次数（防止死循环） */
const MAX_AUTO_CONTINUE = 3;

/**
 * 执行一次搜索请求并写入 store。
 *
 * 写入前会校验 store 中该 slot 的 query 仍为当前 query，
 * 防止 stale 响应覆盖新搜索结果。
 */
async function fetchPage<T extends SearchMediaType>(
    query: string,
    page: number,
    type: T,
    pluginHash: string,
): Promise<{ success: boolean; isEnd: boolean; dataLen: number }> {
    try {
        const result = await pluginManager.callPluginMethod({
            hash: pluginHash,
            method: 'search',
            args: [query, page, type],
        });

        // ── Stale guard：写入前确认 slot 的 query 没有被更新 ──
        const current = getPluginResult(type, pluginHash);
        if (current && current.query !== query) {
            // 用户已切换关键词，丢弃本次结果
            return { success: false, isEnd: true, dataLen: 0 };
        }

        const resData = (result?.data ?? []) as IMedia.SupportMediaItem[T][];
        const resIsEnd = result?.isEnd ?? true;

        if (__DEV__) {
            console.log(
                `[useSearch] ${pluginHash} / ${type} / page ${page}:`,
                `${resData.length} items, isEnd=${resIsEnd}`,
                resData,
            );
        }

        const prevData = (current?.data ?? []) as IMedia.SupportMediaItem[T][];

        setPluginResult(type, pluginHash, {
            query,
            page,
            isEnd: resIsEnd,
            status: RequestStatus.Done,
            data: page === 1 ? resData : [...prevData, ...resData],
        });

        return { success: true, isEnd: resIsEnd, dataLen: resData.length };
    } catch (err) {
        // Stale guard on error path too
        const current = getPluginResult(type, pluginHash);
        if (current && current.query !== query) {
            return { success: false, isEnd: true, dataLen: 0 };
        }

        console.error(`[useSearch] search failed: ${pluginHash} / ${type} / page ${page}`, err);
        setPluginResult(type, pluginHash, {
            status: RequestStatus.Error,
        });
        return { success: false, isEnd: true, dataLen: 0 };
    }
}

/**
 * 自动续页：如果当前页返回空数据但 isEnd 为 false，自动拉取下一页。
 * 最多续 MAX_AUTO_CONTINUE 次。
 *
 * 只检查每轮 fetchPage 的返回值（dataLen）判断是否继续，
 * 不依赖累积数据量（避免 loadMore 场景下已有数据导致立即 break）。
 */
async function autoContinue<T extends SearchMediaType>(
    query: string,
    startPage: number,
    type: T,
    pluginHash: string,
): Promise<void> {
    let page = startPage;
    for (let i = 0; i < MAX_AUTO_CONTINUE; i++) {
        const prev = getPluginResult(type, pluginHash);
        if (!prev || prev.isEnd || prev.query !== query) break;

        page += 1;
        setPluginResult(type, pluginHash, { status: RequestStatus.Pending });

        const result = await fetchPage(query, page, type, pluginHash);
        // 请求失败、到底、或获取到新数据 → 停止自动续页
        if (!result.success || result.isEnd || result.dataLen > 0) break;
    }
}

export function useSearch() {
    // 用于取消过期请求的序列号
    const seqRef = useRef(0);

    /**
     * 首次搜索：从第 1 页开始。
     * 会自动 reset 该 slot 然后拉取。
     */
    const search = useCallback(async (query: string, type: SearchMediaType, pluginHash: string) => {
        if (!query.trim() || !pluginHash) return;

        const seq = ++seqRef.current;

        // 初始化状态
        setPluginResult(type, pluginHash, {
            query,
            page: 1,
            isEnd: false,
            status: RequestStatus.Pending,
            data: [],
        });

        const result = await fetchPage(query, 1, type, pluginHash);

        // 过期检查（双重保险：fetchPage 自身的 stale guard + 此处的 seq 检查）
        if (seqRef.current !== seq) return;

        // 首页无数据且未到底 → 自动续页
        if (result.success && !result.isEnd && result.dataLen === 0) {
            await autoContinue(query, 1, type, pluginHash);
        }
    }, []);

    /**
     * 加载更多：在当前 page 基础上 +1。
     */
    const loadMore = useCallback(async (type: SearchMediaType, pluginHash: string) => {
        const prev = getPluginResult(type, pluginHash);
        if (!prev || prev.isEnd || prev.status === RequestStatus.Pending) return;

        const nextPage = prev.page + 1;
        const { query } = prev;
        if (!query) return;

        setPluginResult(type, pluginHash, { status: RequestStatus.Pending });

        const result = await fetchPage(query, nextPage, type, pluginHash);

        // 本页无数据且未到底 → 自动续页
        if (result.success && !result.isEnd && result.dataLen === 0) {
            await autoContinue(query, nextPage, type, pluginHash);
        }
    }, []);

    return { search, loadMore };
}
