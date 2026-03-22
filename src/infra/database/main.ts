/**
 * database — 主进程层
 *
 * 职责：
 * - 初始化 better-sqlite3 连接（WAL 模式）
 * - 基于 user_version pragma 的增量 schema 迁移
 * - 通过 IDatabaseProvider 接口向其他 main 层模块提供 DB 连接
 *
 * 此模块仅 main 层，无 preload / renderer。
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { IDatabaseProvider } from '@appTypes/infra/database';
import { DB_FILE_NAME } from './common/constant';

class DatabaseInfra implements IDatabaseProvider {
    private isSetup = false;
    private db: Database.Database | null = null;

    /**
     * 初始化数据库连接并执行 schema 迁移。
     * 应在 appConfig 之后、musicSheet / downloadManager 之前调用。
     */
    public setup() {
        if (this.isSetup) return;

        const dbPath = path.join(globalContext.appPath.userData, DB_FILE_NAME);
        this.db = new Database(dbPath);

        // WAL 模式：并发读不阻塞写，写不阻塞读
        this.db.pragma('journal_mode = WAL');
        // 在 WAL 模式下 NORMAL 足够安全，写入速度远快于 FULL
        this.db.pragma('synchronous = NORMAL');

        this.runMigrations();
        this.isSetup = true;
    }

    public getDatabase(): Database.Database {
        if (!this.db) {
            throw new Error('[database] Module not initialized. Call setup() first.');
        }
        return this.db;
    }

    /** 关闭数据库连接。应在应用退出时最后调用。 */
    public dispose() {
        this.db?.close();
        this.db = null;
    }

    /**
     * Schema 版本迁移。
     *
     * 使用 SQLite 内置的 user_version pragma 跟踪版本号。
     * 每个 migration 函数对应一个版本升级（v0→v1, v1→v2, ...）。
     * 所有 migration 在一个事务中执行，保证原子性。
     */
    private runMigrations() {
        const db = this.db!;
        const currentVersion = db.pragma('user_version', { simple: true }) as number;

        const migrations: Array<(db: Database.Database) => void> = [
            // ─── v0 → v1: 初始 schema ───
            (db) => {
                // musicSheet 模块的表
                db.exec(`
                    CREATE TABLE IF NOT EXISTS music_sheets (
                        id          TEXT PRIMARY KEY,
                        title       TEXT NOT NULL,
                        artwork     TEXT,
                        description TEXT,
                        type        TEXT NOT NULL DEFAULT 'user',
                        folder_path TEXT,
                        sort_order  INTEGER DEFAULT 0,
                        created_at  INTEGER NOT NULL,
                        updated_at  INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS music_items (
                        platform    TEXT NOT NULL,
                        id          TEXT NOT NULL,
                        title       TEXT NOT NULL,
                        artist      TEXT DEFAULT '',
                        album       TEXT DEFAULT '',
                        duration    REAL,
                        artwork     TEXT,
                        raw         TEXT,
                        PRIMARY KEY (platform, id)
                    );

                    CREATE TABLE IF NOT EXISTS sheet_music_relation (
                        sheet_id    TEXT NOT NULL,
                        platform    TEXT NOT NULL,
                        music_id    TEXT NOT NULL,
                        sort_order  INTEGER DEFAULT 0,
                        added_at    INTEGER NOT NULL,
                        PRIMARY KEY (sheet_id, platform, music_id),
                        FOREIGN KEY (sheet_id) REFERENCES music_sheets(id) ON DELETE CASCADE,
                        FOREIGN KEY (platform, music_id) REFERENCES music_items(platform, id)
                    );

                    CREATE INDEX IF NOT EXISTS idx_relation_sheet_added
                        ON sheet_music_relation(sheet_id, added_at DESC);

                    CREATE TABLE IF NOT EXISTS starred_sheets (
                        platform    TEXT NOT NULL,
                        id          TEXT NOT NULL,
                        title       TEXT,
                        artwork     TEXT,
                        raw         TEXT,
                        sort_order  INTEGER DEFAULT 0,
                        starred_at  INTEGER NOT NULL,
                        PRIMARY KEY (platform, id)
                    );
                `);
            },

            // ─── v1 → v2: (已废弃) pre_shuffle_order 列，shuffle 已改为纯内存虚拟导航 ───
            // 保留迁移槽位以兼容已升级到 v2 的用户数据库
            () => {},

            // ─── v2 → v3: mediaMeta 模块的 media_meta 表 ───
            (db) => {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS media_meta (
                        platform    TEXT NOT NULL,
                        music_id    TEXT NOT NULL,
                        data        TEXT NOT NULL DEFAULT '{}',
                        updated_at  INTEGER NOT NULL,
                        PRIMARY KEY (platform, music_id)
                    );
                `);
            },

            // ─── v3 → v4: downloadManager 的 download_tasks 表 + mediaMeta shadow 列 ───
            (db) => {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS download_tasks (
                        id                TEXT PRIMARY KEY,
                        platform          TEXT NOT NULL,
                        music_id          TEXT NOT NULL,
                        title             TEXT NOT NULL,
                        artist            TEXT DEFAULT '',
                        album             TEXT DEFAULT '',
                        quality           TEXT NOT NULL,
                        status            TEXT NOT NULL DEFAULT 'pending',
                        file_path         TEXT,
                        temp_path         TEXT,
                        total_bytes       INTEGER DEFAULT 0,
                        downloaded_bytes  INTEGER DEFAULT 0,
                        media_source      TEXT,
                        music_item_raw    TEXT,
                        error             TEXT,
                        created_at        INTEGER NOT NULL,
                        updated_at        INTEGER NOT NULL
                    );

                    CREATE UNIQUE INDEX IF NOT EXISTS idx_download_tasks_unique_music
                        ON download_tasks(platform, music_id);

                    CREATE INDEX IF NOT EXISTS idx_download_tasks_status
                        ON download_tasks(status);

                    ALTER TABLE media_meta ADD COLUMN download_path TEXT;

                    CREATE INDEX IF NOT EXISTS idx_media_meta_download_path
                        ON media_meta(download_path COLLATE NOCASE);
                `);
            },

            // ─── v4 → v5: localMusic 模块的 scan_folders + local_music 表 ───
            (db) => {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS scan_folders (
                        id              TEXT PRIMARY KEY,
                        folder_path     TEXT NOT NULL UNIQUE,
                        last_scan_at    INTEGER,
                        created_at      INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS local_music (
                        file_path       TEXT PRIMARY KEY,
                        platform        TEXT NOT NULL,
                        music_id        TEXT NOT NULL,
                        title           TEXT NOT NULL,
                        artist          TEXT DEFAULT '',
                        album           TEXT DEFAULT '',
                        duration        REAL,
                        artwork         TEXT,
                        folder          TEXT NOT NULL,
                        file_size       INTEGER,
                        file_mtime      INTEGER,
                        scan_folder_id  TEXT NOT NULL,
                        created_at      INTEGER NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_local_music_artist
                        ON local_music(artist);
                    CREATE INDEX IF NOT EXISTS idx_local_music_album
                        ON local_music(album);
                    CREATE INDEX IF NOT EXISTS idx_local_music_folder
                        ON local_music(folder);
                    CREATE INDEX IF NOT EXISTS idx_local_music_scan_folder
                        ON local_music(scan_folder_id);
                    CREATE INDEX IF NOT EXISTS idx_local_music_identity
                        ON local_music(platform, music_id);
                `);
            },
        ];

        if (currentVersion < migrations.length) {
            const migrate = db.transaction(() => {
                for (let i = currentVersion; i < migrations.length; i++) {
                    migrations[i](db);
                }
                db.pragma(`user_version = ${migrations.length}`);
            });
            migrate();
        }
    }
}

const database = new DatabaseInfra();
export default database;
