/**
 * legacyMigration — 旧版 IndexedDB 数据迁移
 *
 * 职责：
 * - 检测旧版 Dexie 创建的 IndexedDB 数据库是否存在
 * - 读取歌单、歌曲、星标歌单、播放队列、最近播放
 * - 通过临时文件 + backup.restoreFromFile 导入歌单数据
 * - 通过已有 IPC 导入星标歌单、播放队列
 * - 通过 asyncKV 写入最近播放
 *
 * 旧版数据库：
 *   musicSheetDB (IDB version 2): stores = sheets, musicStore, localMusicStore
 *   userPerferenceDB (IDB version 1): stores = perference (key-value)
 */

import { syncKV, asyncKV } from '@renderer/common/kvStore';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import type { IBackupData, IBackupSheet } from '@appTypes/infra/backup';

// ─── 常量 ───

const LEGACY_MUSIC_SHEET_DB = 'musicSheetDB';
const LEGACY_USER_PREF_DB = 'userPerferenceDB';

const STORE_SHEETS = 'sheets';
const STORE_MUSIC = 'musicStore';
const STORE_PREF = 'perference';

// ─── 类型 ───

export interface LegacyDetectResult {
    sheetCount: number;
    songCount: number;
}

export interface MigrationResult {
    success: boolean;
    sheetsImported: number;
    songsImported: number;
    error?: string;
}

// ─── 检测旧数据 ───

/**
 * 尝试打开旧版 musicSheetDB，判断是否存在可迁移的歌单数据。
 * 若 DB 不存在（onupgradeneeded 触发时 oldVersion === 0），立即 abort 并返回 null。
 */
export function detectLegacyData(): Promise<LegacyDetectResult | null> {
    return new Promise((resolve) => {
        let aborted = false;

        // 不指定版本号，以当前版本打开（Dexie 生成的 IDB 版本号不可预测）
        const req = indexedDB.open(LEGACY_MUSIC_SHEET_DB);

        req.onupgradeneeded = (event) => {
            // oldVersion === 0 表示数据库之前不存在，Dexie 从未创建过
            if ((event as IDBVersionChangeEvent).oldVersion === 0) {
                aborted = true;
                req.transaction?.abort();
            }
        };

        req.onsuccess = () => {
            if (aborted) {
                // abort 后仍可能触发 onsuccess，清理空库
                try {
                    req.result.close();
                    indexedDB.deleteDatabase(LEGACY_MUSIC_SHEET_DB);
                } catch {
                    // 忽略
                }
                resolve(null);
                return;
            }

            const db = req.result;

            // 检查 store 是否存在
            if (
                !db.objectStoreNames.contains(STORE_SHEETS) ||
                !db.objectStoreNames.contains(STORE_MUSIC)
            ) {
                db.close();
                resolve(null);
                return;
            }

            const tx = db.transaction([STORE_SHEETS, STORE_MUSIC], 'readonly');
            const sheetsStore = tx.objectStore(STORE_SHEETS);
            const musicStoreObj = tx.objectStore(STORE_MUSIC);

            const countSheets = sheetsStore.count();
            const countSongs = musicStoreObj.count();

            tx.oncomplete = () => {
                const sheetCount = countSheets.result ?? 0;
                const songCount = countSongs.result ?? 0;
                db.close();

                if (sheetCount === 0) {
                    resolve(null);
                    return;
                }

                resolve({ sheetCount, songCount });
            };

            tx.onerror = () => {
                db.close();
                resolve(null);
            };
        };

        req.onerror = () => {
            resolve(null);
        };

        req.onblocked = () => {
            resolve(null);
        };
    });
}

// ─── 读取旧版数据 ───

/** 打开指定 IndexedDB 数据库（只读） */
function openLegacyDB(name: string): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        let aborted = false;
        const req = indexedDB.open(name);

        req.onupgradeneeded = (event) => {
            if ((event as IDBVersionChangeEvent).oldVersion === 0) {
                aborted = true;
                req.transaction?.abort();
            }
        };

        req.onsuccess = () => {
            if (aborted) {
                try {
                    req.result.close();
                    indexedDB.deleteDatabase(name);
                } catch {
                    // 忽略
                }
                resolve(null);
                return;
            }
            resolve(req.result);
        };

        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
    });
}

/** 读取 object store 中的所有记录 */
function readAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(storeName)) {
            resolve([]);
            return;
        }
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
    });
}

/** 从 object store 中批量获取指定键的记录 */
function bulkGetFromStore<T>(
    db: IDBDatabase,
    storeName: string,
    keys: IDBValidKey[],
): Promise<(T | undefined)[]> {
    return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(storeName)) {
            resolve([]);
            return;
        }
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const results: (T | undefined)[] = [];
        let completed = 0;

        if (keys.length === 0) {
            resolve([]);
            return;
        }

        for (let i = 0; i < keys.length; i++) {
            const req = store.get(keys[i]);
            req.onsuccess = () => {
                results[i] = req.result;
                completed++;
                if (completed === keys.length) {
                    resolve(results);
                }
            };
            req.onerror = () => {
                results[i] = undefined;
                completed++;
                if (completed === keys.length) {
                    resolve(results);
                }
            };
        }
    });
}

/** 从 userPerferenceDB 读取指定 key 的值 */
function readPrefValue<T>(db: IDBDatabase, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_PREF)) {
            resolve(null);
            return;
        }
        const tx = db.transaction(STORE_PREF, 'readonly');
        const req = tx.objectStore(STORE_PREF).get(key);
        req.onsuccess = () => resolve(req.result?.value ?? null);
        req.onerror = () => reject(req.error);
    });
}

/**
 * 清洗旧版 IMusicItem：移除内部字段、统一 id 为 string。
 * 返回 null 表示该记录无效应跳过。
 */
function sanitizeMusicItem(raw: any): IMusic.IMusicItem | null {
    if (!raw || !raw.platform || raw.id == null || !raw.title) {
        return null;
    }

    // 浅拷贝并移除 Dexie 内部字段
    const { $$ref: _, $$localPath: __, ...item } = raw;

    // 统一 id 为 string
    item.id = String(item.id);

    return item as IMusic.IMusicItem;
}

// ─── 执行迁移 ───

/**
 * 执行完整迁移流程。
 *
 * 1. 读取旧版 musicSheetDB 的歌单 + 歌曲
 * 2. 组装 IBackupData JSON → 写入临时文件 → 调用 backup.restoreFromFile → 删除临时文件
 * 3. 迁移星标歌单（通过 musicSheet.starMusicSheet IPC）
 * 4. 迁移播放队列（通过 playQueueBridge.set）
 * 5. 迁移最近播放（通过 asyncKV）
 */
export async function executeMigration(): Promise<MigrationResult> {
    // 延迟导入避免循环依赖
    const { default: backup } = await import('@infra/backup/renderer');
    const { default: musicSheet, playQueueBridge } = await import('@infra/musicSheet/renderer');
    const { default: fsUtil } = await import('@infra/fsUtil/renderer');

    try {
        // ── 1. 读取歌单数据 ──

        const musicDB = await openLegacyDB(LEGACY_MUSIC_SHEET_DB);
        if (!musicDB) {
            return { success: true, sheetsImported: 0, songsImported: 0 };
        }

        const sheets: any[] = await readAllFromStore(musicDB, STORE_SHEETS);

        // 收集所有歌曲引用，去重
        const allMusicKeys = new Map<string, IDBValidKey>();
        for (const sheet of sheets) {
            const musicList: any[] = sheet.musicList ?? [];
            for (const ref of musicList) {
                if (ref?.platform != null && ref?.id != null) {
                    const key = `${ref.platform}@${ref.id}`;
                    if (!allMusicKeys.has(key)) {
                        allMusicKeys.set(key, [ref.platform, ref.id]);
                    }
                }
            }
        }

        // 批量拉取完整歌曲数据
        const musicKeys = Array.from(allMusicKeys.values());
        const allMusicItems = await bulkGetFromStore<any>(musicDB, STORE_MUSIC, musicKeys);
        const musicPool = new Map<string, IMusic.IMusicItem>();
        for (const raw of allMusicItems) {
            const item = sanitizeMusicItem(raw);
            if (item) {
                musicPool.set(`${item.platform}@${item.id}`, item);
            }
        }

        // 组装 IBackupSheet[]
        const backupSheets: IBackupSheet[] = [];
        let totalSongs = 0;

        for (const sheet of sheets) {
            const musicList: IMusic.IMusicItem[] = [];
            for (const ref of sheet.musicList ?? []) {
                if (ref?.platform == null || ref?.id == null) continue;
                const item = musicPool.get(`${ref.platform}@${ref.id}`);
                if (item) {
                    musicList.push(item);
                }
            }

            backupSheets.push({
                id: sheet.id ?? '',
                title: sheet.title ?? '',
                musicList,
            });
            totalSongs += musicList.length;
        }

        musicDB.close();

        // ── 2. 通过临时文件导入歌单 ──

        if (backupSheets.length > 0) {
            const backupData: IBackupData = {
                version: 1,
                createdAt: Date.now(),
                musicSheets: backupSheets,
            };

            const tempPath = `${globalContext.appPath.temp}/legacy_migration_${Date.now()}.json`;

            try {
                await fsUtil.writeFile(tempPath, JSON.stringify(backupData), {
                    encoding: 'utf-8',
                });
                await backup.restoreFromFile(tempPath, 'append');
            } finally {
                // 无论成功失败均删除临时文件
                try {
                    await fsUtil.rimraf(tempPath);
                } catch {
                    // 忽略清理失败
                }
            }
        }

        // ── 3. 迁移星标歌单、播放队列、最近播放 ──

        const prefDB = await openLegacyDB(LEGACY_USER_PREF_DB);
        if (prefDB) {
            try {
                // 星标歌单（旧版存储了完整 IMusicSheetItem 对象）
                const starredSheets = await readPrefValue<IMusic.IMusicSheetItem[]>(
                    prefDB,
                    'starredMusicSheets',
                );
                if (starredSheets?.length) {
                    for (const sheet of starredSheets) {
                        if (sheet?.platform && sheet?.id != null) {
                            try {
                                await musicSheet.starMusicSheet({
                                    ...sheet,
                                    id: String(sheet.id),
                                } as IMusic.IMusicSheetItem);
                            } catch {
                                // 单条失败不中断
                            }
                        }
                    }
                }

                // 播放队列
                const playList = await readPrefValue<IMusic.IMusicItem[]>(prefDB, 'playList');
                if (playList?.length) {
                    const cleanedPlayList = playList
                        .map(sanitizeMusicItem)
                        .filter((it): it is IMusic.IMusicItem => it !== null);
                    if (cleanedPlayList.length > 0) {
                        await playQueueBridge.set(cleanedPlayList);
                    }
                }

                // 最近播放
                const recentlyPlayList = await readPrefValue<IMusic.IMusicItem[]>(
                    prefDB,
                    'recentlyPlayList',
                );
                if (recentlyPlayList?.length) {
                    const cleanedRecent = recentlyPlayList
                        .map(sanitizeMusicItem)
                        .filter((it): it is IMusic.IMusicItem => it !== null);
                    if (cleanedRecent.length > 0) {
                        await asyncKV.set('recentlyPlayed', cleanedRecent);
                    }
                }
            } finally {
                prefDB.close();
            }
        }

        return {
            success: true,
            sheetsImported: backupSheets.length,
            songsImported: totalSongs,
        };
    } catch (e) {
        return {
            success: false,
            sheetsImported: 0,
            songsImported: 0,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

// ─── 入口 ───

/**
 * 启动后检测旧版数据并弹窗引导迁移。
 * 由 postBootstrap 调用，不阻塞 UI。
 */
export async function checkLegacyMigration(): Promise<void> {
    // 已完成过迁移（无论选择导入或跳过），不再检测
    if (syncKV.get('migration.v1Completed')) {
        return;
    }

    try {
        const result = await detectLegacyData();
        if (!result) {
            // 无旧数据，静默标记完成
            syncKV.set('migration.v1Completed', true);
            return;
        }

        // 弹窗让用户确认
        showModal('LegacyMigrationModal', { detectResult: result });
    } catch (e) {
        console.error('[LegacyMigration] Detection failed:', e);
    }
}
