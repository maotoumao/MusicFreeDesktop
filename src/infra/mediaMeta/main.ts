/**
 * mediaMeta — 主进程层
 *
 * 职责：
 * - 管理 media_meta 表的 CRUD（prepared statements）
 * - RFC 7396 JSON Merge Patch 更新语义
 * - IPC 注册（handle + broadcast）
 * - 启动时异步执行过期清理
 *
 * 暴露名称: '@infra/media-meta'
 */

import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IDatabaseProvider } from '@appTypes/infra/database';
import type {
    IMediaMeta,
    MediaMetaPatch,
    IMediaMetaChangeEvent,
    IMediaMetaProvider,
} from '@appTypes/infra/mediaMeta';
import { compositeKey } from '@common/mediaKey';
import { IPC } from './common/constant';

interface IQueries {
    getMeta: Database.Statement;
    upsertMeta: Database.Statement;
    deleteMeta: Database.Statement;
    queryByField: Database.Statement;
    cleanExpired: Database.Statement;
    getMetaByDownloadPath: Database.Statement;
    getAllDownloaded: Database.Statement;
}

/** 过期清理阈值（毫秒）：90 天 */
const EXPIRY_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;

class MediaMetaManager {
    private isSetup = false;
    private db!: Database.Database;
    private windowManager!: IWindowManager;
    private queries!: IQueries;

    public setup(deps: { db: IDatabaseProvider; windowManager: IWindowManager }) {
        if (this.isSetup) return;

        this.db = deps.db.getDatabase();
        this.windowManager = deps.windowManager;

        this.queries = {
            getMeta: this.db.prepare(
                'SELECT data FROM media_meta WHERE platform = ? AND music_id = ?',
            ),
            upsertMeta: this.db.prepare(`
                INSERT INTO media_meta (platform, music_id, data, updated_at, download_path)
                VALUES (@platform, @musicId, @data, @updatedAt, @downloadPath)
                ON CONFLICT(platform, music_id) DO UPDATE SET
                    data = @data, updated_at = @updatedAt, download_path = @downloadPath
            `),
            deleteMeta: this.db.prepare(
                'DELETE FROM media_meta WHERE platform = ? AND music_id = ?',
            ),
            queryByField: this.db.prepare(
                `SELECT platform, music_id, data FROM media_meta
                 WHERE json_extract(data, '$.' || ?) IS NOT NULL`,
            ),
            cleanExpired: this.db.prepare(`
                DELETE FROM media_meta
                WHERE updated_at < ?
                  AND NOT EXISTS (
                      SELECT 1 FROM sheet_music_relation smr
                      WHERE smr.platform = media_meta.platform
                        AND smr.music_id = media_meta.music_id
                  )
            `),
            getMetaByDownloadPath: this.db.prepare(
                'SELECT platform, music_id, data FROM media_meta WHERE download_path = ? COLLATE NOCASE',
            ),
            getAllDownloaded: this.db.prepare(
                'SELECT platform, music_id, data FROM media_meta WHERE download_path IS NOT NULL',
            ),
        };

        this.registerIpcHandlers();

        // 启动时异步执行过期清理
        this.scheduleCleanup();

        this.isSetup = true;
    }

    // ─── 核心方法（供 Main 进程内其他模块通过 DI 调用） ────────

    /** 获取单条 meta */
    public getMeta(platform: string, musicId: string): IMediaMeta | null {
        const row = this.queries.getMeta.get(platform, musicId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    }

    /**
     * 批量获取 meta。
     * 返回 [compositeKey, IMediaMeta] 元组数组，方便序列化传输。
     */
    public batchGetMeta(
        keys: Array<{ platform: string; musicId: string }>,
    ): Array<[string, IMediaMeta]> {
        const result: Array<[string, IMediaMeta]> = [];
        for (const { platform, musicId } of keys) {
            const meta = this.getMeta(platform, musicId);
            if (meta) {
                result.push([compositeKey(platform, musicId), meta]);
            }
        }
        return result;
    }

    /**
     * 设置 meta（RFC 7396 JSON Merge Patch）。
     *
     * 读取现有 data → 遍历 patch：null 值删除 key，非 null 值覆盖 → 写回。
     * 各模块可独立更新自己负责的字段，互不干扰。
     */
    public setMeta(platform: string, musicId: string, patch: MediaMetaPatch): void {
        const existing = this.getMeta(platform, musicId) ?? ({} as IMediaMeta);
        const merged: Record<string, unknown> = { ...existing };

        for (const [key, value] of Object.entries(patch)) {
            if (value === null) {
                delete merged[key];
            } else {
                merged[key] = value;
            }
        }

        // Shadow 列自动同步：从 downloadData.path 提取到 download_path
        const mergedMeta = merged as IMediaMeta;
        const downloadPath = mergedMeta.downloadData?.path ?? null;

        this.queries.upsertMeta.run({
            platform,
            musicId,
            data: JSON.stringify(merged),
            updatedAt: Date.now(),
            downloadPath,
        });

        this.broadcast({ platform, musicId, meta: mergedMeta });
    }

    /** 删除 meta */
    public deleteMeta(platform: string, musicId: string): void {
        this.queries.deleteMeta.run(platform, musicId);
        this.broadcast({ platform, musicId, meta: null });
    }

    /**
     * 通过下载路径反查原始歌曲的 platform + musicId。
     * 供本地扫描引擎在主进程内通过 DI 调用，不暴露 IPC。
     */
    public getMetaByDownloadPath(
        filePath: string,
    ): { platform: string; musicId: string; meta: IMediaMeta } | null {
        const row = this.queries.getMetaByDownloadPath.get(filePath) as
            | { platform: string; music_id: string; data: string }
            | undefined;
        if (!row) return null;
        return {
            platform: row.platform,
            musicId: row.music_id,
            meta: JSON.parse(row.data),
        };
    }

    /**
     * 获取所有已下载歌曲的下载信息。
     * 使用 download_path shadow 列索引扫描，避免 json_extract 全表扫描。
     */
    public getAllDownloaded(): Array<{
        platform: string;
        musicId: string;
        path: string;
        quality: IMusic.IQualityKey;
    }> {
        const rows = this.queries.getAllDownloaded.all() as Array<{
            platform: string;
            music_id: string;
            data: string;
        }>;
        const result: Array<{
            platform: string;
            musicId: string;
            path: string;
            quality: IMusic.IQualityKey;
        }> = [];
        for (const row of rows) {
            const meta: IMediaMeta = JSON.parse(row.data);
            if (meta.downloadData) {
                result.push({
                    platform: row.platform,
                    musicId: row.music_id,
                    path: meta.downloadData.path,
                    quality: meta.downloadData.quality,
                });
            }
        }
        return result;
    }

    /**
     * 返回统一的 DI 适配器，供 downloadManager / localMusic / pluginManager 等消费。
     */
    public getProvider(): IMediaMetaProvider {
        return {
            setMeta: this.setMeta.bind(this),
            getDownloadData: (platform: string, musicId: string) => {
                const meta = this.getMeta(platform, musicId);
                return meta?.downloadData ?? null;
            },
            getAllDownloaded: () => this.getAllDownloaded(),
            getMetaByDownloadPath: (filePath: string) => {
                const result = this.getMetaByDownloadPath(filePath);
                return result ? { platform: result.platform, musicId: result.musicId } : null;
            },
            getAssociatedLyric: (platform: string, musicId: string) => {
                const meta = this.getMeta(platform, musicId);
                return meta?.associatedLyric ?? null;
            },
        };
    }

    /** 按字段查询所有含该字段的 meta（如 'downloadData'） */
    public queryByField(
        field: string,
    ): Array<{ platform: string; musicId: string; meta: IMediaMeta }> {
        const rows = this.queries.queryByField.all(field) as Array<{
            platform: string;
            music_id: string;
            data: string;
        }>;
        return rows.map((r) => ({
            platform: r.platform,
            musicId: r.music_id,
            meta: JSON.parse(r.data),
        }));
    }

    // ─── 内部方法 ────────────────────────

    private registerIpcHandlers(): void {
        ipcMain.handle(IPC.GET_META, (_evt, platform: string, musicId: string) => {
            return this.getMeta(platform, musicId);
        });

        ipcMain.handle(
            IPC.BATCH_GET_META,
            (_evt, keys: Array<{ platform: string; musicId: string }>) => {
                return this.batchGetMeta(keys);
            },
        );

        ipcMain.handle(
            IPC.SET_META,
            (_evt, platform: string, musicId: string, patch: MediaMetaPatch) => {
                this.setMeta(platform, musicId, patch);
            },
        );

        ipcMain.handle(IPC.DELETE_META, (_evt, platform: string, musicId: string) => {
            this.deleteMeta(platform, musicId);
        });

        ipcMain.handle(IPC.QUERY_BY_FIELD, (_evt, field: string) => {
            return this.queryByField(field);
        });
    }

    /** 广播 meta 变更事件到所有渲染进程窗口 */
    private broadcast(event: IMediaMetaChangeEvent): void {
        this.windowManager.broadcast(IPC.META_CHANGED, event);
    }

    /**
     * 异步执行过期清理。
     * 双条件：updated_at 超过阈值 AND 不在任何 sheet_music_relation 中。
     */
    private scheduleCleanup(): void {
        setTimeout(() => {
            try {
                const threshold = Date.now() - EXPIRY_THRESHOLD_MS;
                this.queries.cleanExpired.run(threshold);
            } catch (e) {
                console.error('[mediaMeta] cleanup failed:', e);
            }
        }, 10000); // 延迟 10s，避免阻塞启动
    }
}

const mediaMeta = new MediaMetaManager();
export default mediaMeta;
