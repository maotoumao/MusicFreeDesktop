/**
 * 搜索历史 — 基于 syncKV 的简易持久化工具
 *
 * - 新增记录去重并置顶
 * - 上限由 appConfig `normal.maxHistoryLength` 控制（默认 30）
 */

import { syncKV } from '@renderer/common/kvStore';
import appConfig from '@infra/appConfig/renderer';

const KV_KEY = 'search.history' as const;

/** 读取搜索历史（有序，最近在前） */
export function getSearchHistory(): string[] {
    return syncKV.get(KV_KEY) ?? [];
}

/** 新增一条搜索记录（去重 + 置顶 + 截断） */
export function addSearchHistory(query: string): string[] {
    const trimmed = query.trim();
    if (!trimmed) return getSearchHistory();

    const maxLen = appConfig.getConfigByKey('normal.maxHistoryLength') ?? 30;
    const prev = getSearchHistory().filter((item) => item !== trimmed);
    const next = [trimmed, ...prev].slice(0, maxLen);
    syncKV.set(KV_KEY, next);
    return next;
}

/** 清空搜索历史 */
export function clearSearchHistory(): void {
    syncKV.remove(KV_KEY);
}
