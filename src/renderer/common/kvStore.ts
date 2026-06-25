/**
 * KV 存储 — Renderer 通用工具
 *
 * - syncKV: 基于 localStorage 的同步读写（首帧即可用）
 * - asyncKV: 基于 IndexedDB 的异步读写（大数据 / 未来扩展）
 *
 * 所有 key-value 类型映射集中在此文件顶部，不使用 declaration merging。
 */

import type { RepeatMode } from '@common/constant';

// ═══════════════════════════════════════════════════════
// Schema 定义
// ═══════════════════════════════════════════════════════

/** 同步 KV Schema（localStorage） */
export interface ISyncKVSchema {
    'player.volume': number;
    'player.speed': number;
    'player.repeatMode': RepeatMode;
    'player.currentMusic': IMusic.IMusicItem | null;
    'player.currentProgress': number;
    'player.currentQuality': IMusic.IQualityKey;
    'player.lyricFontScale': number;
    'player.showLyricTranslation': boolean;
    'search.history': string[];
    /** 用户选择跳过的软件更新版本号 */
    'update.skipVersion': string;
    /** 旧版数据迁移是否已完成（无论用户选择迁移或跳过，均标记为 true） */
    'migration.v1Completed': boolean;
}

/** 异步 KV Schema（IndexedDB） */
export interface IAsyncKVSchema {
    /** 最近播放列表（完整 IMusicItem，按时间倒序） */
    recentlyPlayed: IMusic.IMusicItem[];
}

// ═══════════════════════════════════════════════════════
// syncKV
// ═══════════════════════════════════════════════════════

export const syncKV = {
    get<K extends keyof ISyncKVSchema>(key: K): ISyncKVSchema[K] | null {
        const raw = localStorage.getItem(key as string);
        if (raw === null) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    set<K extends keyof ISyncKVSchema>(key: K, value: ISyncKVSchema[K]): void {
        localStorage.setItem(key as string, JSON.stringify(value));
    },

    remove<K extends keyof ISyncKVSchema>(key: K): void {
        localStorage.removeItem(key as string);
    },
};

// ═══════════════════════════════════════════════════════
// asyncKV
// ═══════════════════════════════════════════════════════

const DB_NAME = 'MusicFreeKV';
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                dbPromise = null; // 允许后续重试
                reject(req.error);
            };
        });
    }
    return dbPromise;
}

export const asyncKV = {
    async get<K extends keyof IAsyncKVSchema>(key: K): Promise<IAsyncKVSchema[K] | undefined> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key as string);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async set<K extends keyof IAsyncKVSchema>(key: K, value: IAsyncKVSchema[K]): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(value, key as string);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async remove<K extends keyof IAsyncKVSchema>(key: K): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key as string);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
};
