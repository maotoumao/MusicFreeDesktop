/**
 * LocalMusicPage Store — jotai 全局状态
 *
 * 数据源：通过异步 IPC 获取全量 IMusicItem[]（含 folder 字段）。
 * 聚合/过滤全部在渲染进程侧通过 atom 派生同步完成。
 *
 * 首次进入页面时加载，之后 libraryChanged 自动刷新（防抖 200ms）。
 * 数据常驻内存，再次进入页面秒开。
 */

import { atom, getDefaultStore } from 'jotai';
import localMusic from '@infra/localMusic/renderer';
import appConfig from '@infra/appConfig/renderer';
import debounce from '@common/debounce';

const store = getDefaultStore();

// ─── 类型 ───

/** IMusicItem + folder（由主进程 toMusicItem 附加） */
export type LocalMusicItem = IMusic.IMusicItem & { folder: string };

export interface ArtistAggregation {
    artist: string;
    count: number;
}

export interface AlbumAggregation {
    album: string;
    artist: string;
    count: number;
}

export interface FolderAggregation {
    folder: string;
    count: number;
}

// ─── 源数据 Atom ───

/** 全量本地音乐 */
const allLocalMusicAtom = atom<LocalMusicItem[]>([]);

/** 是否正在加载（仅首次） */
export const localMusicLoadingAtom = atom(true);

/** 是否正在扫描本地音乐 */
export const scanningAtom = atom(false);

/** 最短时长过滤阈值（秒），0 = 不过滤 */
export const minDurationSecAtom = atom(0);

// ─── 派生 Atom ───

/** 过滤后的本地音乐（按 minDurationSec 过滤短音频） */
export const filteredLocalMusicAtom = atom<LocalMusicItem[]>((get) => {
    const songs = get(allLocalMusicAtom);
    const minDuration = get(minDurationSecAtom);
    if (minDuration <= 0) return songs;
    return songs.filter((s) => s.duration == null || s.duration >= minDuration);
});

/** 歌手聚合列表 */
export const artistListAtom = atom<ArtistAggregation[]>((get) => {
    const songs = get(filteredLocalMusicAtom);
    const map = new Map<string, number>();
    for (const s of songs) {
        map.set(s.artist, (map.get(s.artist) ?? 0) + 1);
    }
    return Array.from(map, ([artist, count]) => ({ artist, count })).sort((a, b) =>
        a.artist.localeCompare(b.artist),
    );
});

/** 专辑聚合列表 */
export const albumListAtom = atom<AlbumAggregation[]>((get) => {
    const songs = get(filteredLocalMusicAtom);
    const map = new Map<string, AlbumAggregation>();
    for (const s of songs) {
        const key = `${s.album ?? ''}||${s.artist}`;
        const existing = map.get(key);
        if (existing) {
            existing.count++;
        } else {
            map.set(key, { album: s.album ?? '', artist: s.artist, count: 1 });
        }
    }
    return Array.from(map.values()).sort((a, b) => a.album.localeCompare(b.album));
});

/** 文件夹聚合列表 */
export const folderListAtom = atom<FolderAggregation[]>((get) => {
    const songs = get(filteredLocalMusicAtom);
    const map = new Map<string, number>();
    for (const s of songs) {
        map.set(s.folder, (map.get(s.folder) ?? 0) + 1);
    }
    return Array.from(map, ([folder, count]) => ({ folder, count })).sort((a, b) =>
        a.folder.localeCompare(b.folder),
    );
});

/** 总歌曲数 */
export const totalCountAtom = atom((get) => get(filteredLocalMusicAtom).length);

// ─── 初始化 ───

let initialized = false;
let loadGeneration = 0;

async function loadAllMusicItems() {
    const gen = ++loadGeneration;
    try {
        const items = (await localMusic.getAllMusicItems()) as LocalMusicItem[];
        if (gen !== loadGeneration) return;
        store.set(allLocalMusicAtom, items);
    } catch (e) {
        if (gen !== loadGeneration) return;
        console.error('[LocalMusicPage] load all music items error:', e);
    } finally {
        if (gen === loadGeneration) {
            store.set(localMusicLoadingAtom, false);
        }
    }
}

const debouncedLoad = debounce(loadAllMusicItems, 200);

/**
 * 确保本地音乐数据已加载。
 * 首次调用时异步拉取全量并注册 libraryChanged 监听。
 * 多次调用安全（幂等）。注册的监听为永久性全局监听，无需清理。
 */
export function ensureLocalMusicStore() {
    if (initialized) return;
    initialized = true;

    // 初始化 minDurationSec
    store.set(minDurationSecAtom, appConfig.getConfigByKey('localMusic.minDurationSec') ?? 0);

    // 监听配置变化，同步 minDurationSec
    appConfig.onConfigUpdated((patch) => {
        if ('localMusic.minDurationSec' in patch) {
            store.set(minDurationSecAtom, patch['localMusic.minDurationSec'] ?? 0);
        }
    });

    loadAllMusicItems();

    localMusic.onLibraryChanged(() => {
        debouncedLoad();
    });

    localMusic.onScanProgress((p) => {
        store.set(scanningAtom, p.phase !== 'done');
    });
}
