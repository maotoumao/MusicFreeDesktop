/**
 * RecentlyPlayed — 最近播放列表管理
 *
 * 存储层：IndexedDB（通过 asyncKV），完整 IMusicItem 数据。
 * 内存层：jotai atom，驱动 UI。
 * 自守护初始化：无需显式 setup()，首次读写时自动加载。
 */
import { atom, getDefaultStore } from 'jotai';
import { useAtomValue } from 'jotai/react';
import { useEffect } from 'react';
import { isSameMedia } from '@common/mediaKey';
import { asyncKV } from '@renderer/common/kvStore';
import logger from '@infra/logger/renderer';

// ─── 常量 ───

/** 最近播放列表硬上限 */
const HARD_LIMIT = 500;

/** 最近播放虚拟 sheetId（用于右键菜单识别） */
export const RECENTLY_PLAYED_ID = '__recently-played__';

// ─── State ───

const store = getDefaultStore();
const recentlyPlayedAtom = atom<IMusic.IMusicItem[]>([]);

// ─── 自守护加载 ───

let loadPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
    if (!loadPromise) {
        loadPromise = asyncKV
            .get('recentlyPlayed')
            .then((list) => {
                store.set(recentlyPlayedAtom, list ?? []);
            })
            .catch((e) => {
                // 重置，允许下次访问重试
                loadPromise = null;
                logger.warn('[recentlyPlayed] Failed to load from IndexedDB', e);
            });
    }
    return loadPromise;
}

// ─── Public API ───

/**
 * 添加到最近播放。去重 + prepend + 截断。
 * 若已存在则移到队首，不产生重复记录。
 */
export async function addToRecentlyPlayed(musicItem: IMusic.IMusicItem): Promise<void> {
    if (!musicItem?.id || !musicItem?.platform) return;

    await ensureLoaded();

    const current = store.get(recentlyPlayedAtom);
    const filtered = current.filter((it) => !isSameMedia(it, musicItem));
    const next = [musicItem, ...filtered].slice(0, HARD_LIMIT);

    store.set(recentlyPlayedAtom, next);
    asyncKV.set('recentlyPlayed', next).catch((e) => {
        logger.warn('[recentlyPlayed] Failed to persist after add', e);
    });
}

/**
 * 从最近播放移除指定歌曲（支持批量）。
 */
export async function removeFromRecentlyPlayed(
    targets: IMedia.IMediaBase | IMedia.IMediaBase[],
): Promise<void> {
    await ensureLoaded();

    const bases = Array.isArray(targets) ? targets : [targets];
    const current = store.get(recentlyPlayedAtom);
    const next = current.filter((it) => !bases.some((t) => isSameMedia(it, t)));

    store.set(recentlyPlayedAtom, next);
    asyncKV.set('recentlyPlayed', next).catch((e) => {
        logger.warn('[recentlyPlayed] Failed to persist after remove', e);
    });
}

/**
 * 清空全部最近播放记录。
 */
export async function clearRecentlyPlayed(): Promise<void> {
    await ensureLoaded();
    store.set(recentlyPlayedAtom, []);
    asyncKV.remove('recentlyPlayed').catch((e) => {
        logger.warn('[recentlyPlayed] Failed to persist after clear', e);
    });
}

// ─── React Hook ───

/**
 * 订阅最近播放列表。首次挂载时自动触发 IndexedDB 加载。
 */
export function useRecentlyPlayedList(): IMusic.IMusicItem[] {
    useEffect(() => {
        ensureLoaded();
    }, []);
    return useAtomValue(recentlyPlayedAtom);
}
