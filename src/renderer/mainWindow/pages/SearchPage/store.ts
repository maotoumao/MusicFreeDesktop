/**
 * SearchPage — Jotai Store
 *
 * 使用 jotai atom 管理搜索状态，便于：
 * 1. 跨组件共享（TabBar、Chips、ResultBody）
 * 2. 未来前进/后退时恢复搜索快照
 *
 * 数据结构：
 *   searchResults[mediaType][pluginHash] → IPluginSearchResult
 *   每条记录保存当前 plugin + type 组合下的分页、数据、状态。
 */

import { atom, getDefaultStore } from 'jotai';
import { RequestStatus } from '@common/constant';

// ── 外部常量 ──

/** 搜索页支持的 4 种媒体类型（排除 lyric） */
export const SEARCH_MEDIA_TYPES = ['music', 'album', 'artist', 'sheet'] as const;
export type SearchMediaType = (typeof SEARCH_MEDIA_TYPES)[number];

export const SEARCH_TAB_LABEL_KEYS: Record<SearchMediaType, string> = {
    music: 'media.type_music',
    album: 'media.type_album',
    artist: 'media.type_artist',
    sheet: 'media.type_sheet',
};

// ── 单条搜索记录 ──

export interface IPluginSearchResult<T extends SearchMediaType = SearchMediaType> {
    /** 搜索关键词（用于校验 stale 响应） */
    query: string;
    /** 当前已加载到第几页 */
    page: number;
    /** 是否到底 */
    isEnd: boolean;
    /** 请求状态 */
    status: RequestStatus;
    /** 累积结果 */
    data: IMedia.SupportMediaItem[T][];
}

// ── 完整结果映射 ──

/**
 * searchResults[mediaType][pluginHash] → IPluginSearchResult
 */
export type SearchResultMap = {
    [T in SearchMediaType]: Record<string, IPluginSearchResult<T>>;
};

function emptyResultMap(): SearchResultMap {
    return {
        music: {},
        album: {},
        artist: {},
        sheet: {},
    };
}

// ── Atoms ──

/** 当前搜索关键词（由路由 params 驱动） */
export const searchQueryAtom = atom<string>('');

/** 全部搜索结果 */
export const searchResultsAtom = atom<SearchResultMap>(emptyResultMap());

/** 当前激活的媒体类型 tab */
export const activeMediaTypeAtom = atom<SearchMediaType>('music');

/**
 * 每种媒体类型各自记忆上次选中的插件 hash。
 * 值为 pluginHash，空字符串表示尚未选择（将使用第一个可用插件）。
 */
export const activePluginPerTypeAtom = atom<Record<SearchMediaType, string>>({
    music: '',
    album: '',
    artist: '',
    sheet: '',
});

// ── Store 实例 ──

export const store = getDefaultStore();

// ── 工具函数 ──

/** 获取某个 plugin + type 组合下的搜索结果 */
export function getPluginResult<T extends SearchMediaType>(
    type: T,
    pluginHash: string,
): IPluginSearchResult<T> | undefined {
    const map = store.get(searchResultsAtom);
    return map[type][pluginHash] as IPluginSearchResult<T> | undefined;
}

/** 更新某个 plugin + type 组合下的搜索结果（immutable） */
export function setPluginResult<T extends SearchMediaType>(
    type: T,
    pluginHash: string,
    updater:
        | Partial<IPluginSearchResult<T>>
        | ((prev: IPluginSearchResult<T>) => Partial<IPluginSearchResult<T>>),
): void {
    const map = store.get(searchResultsAtom);
    const prev =
        (map[type][pluginHash] as IPluginSearchResult<T>) ??
        ({
            query: '',
            page: 0,
            isEnd: false,
            status: RequestStatus.Idle,
            data: [],
        } satisfies IPluginSearchResult<T>);
    const patch = typeof updater === 'function' ? updater(prev) : updater;
    const next: SearchResultMap = {
        ...map,
        [type]: {
            ...map[type],
            [pluginHash]: { ...prev, ...patch },
        },
    };
    store.set(searchResultsAtom, next);
}

/** 重置全部搜索结果（通常在 query 变化时调用） */
export function resetSearchResults(): void {
    store.set(searchResultsAtom, emptyResultMap());
}
