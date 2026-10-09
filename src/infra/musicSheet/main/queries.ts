/**
 * musicSheet — Prepared Statements
 *
 * 封装所有 musicSheet 模块的预编译 SQL 语句。
 */
import type Database from 'better-sqlite3';

export function createQueries(db: Database.Database) {
    return {
        // ─── 歌单 ────────────────────────────

        getAllSheets: db.prepare(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM sheet_music_relation r WHERE r.sheet_id = s.id) AS worksNum,
                   CASE WHEN s.artwork IS NOT NULL THEN NULL ELSE (
                       SELECT m.artwork
                       FROM music_items m
                       JOIN sheet_music_relation r ON m.platform = r.platform AND m.id = r.music_id
                       WHERE r.sheet_id = s.id AND m.artwork IS NOT NULL
                       ORDER BY r.added_at DESC
                       LIMIT 1
                   ) END AS latestArtwork
            FROM music_sheets s
            ORDER BY s.sort_order ASC, s.created_at DESC
        `),

        getSheetById: db.prepare(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM sheet_music_relation r WHERE r.sheet_id = s.id) AS worksNum,
                   CASE WHEN s.artwork IS NOT NULL THEN NULL ELSE (
                       SELECT m.artwork
                       FROM music_items m
                       JOIN sheet_music_relation r ON m.platform = r.platform AND m.id = r.music_id
                       WHERE r.sheet_id = s.id AND m.artwork IS NOT NULL
                       ORDER BY r.added_at DESC
                       LIMIT 1
                   ) END AS latestArtwork
            FROM music_sheets s
            WHERE s.id = ?
        `),

        insertSheet: db.prepare(`
            INSERT INTO music_sheets (id, title, artwork, description, type, folder_path, sort_order, created_at, updated_at)
            VALUES (@id, @title, @artwork, @description, @type, @folderPath, @sortOrder, @createdAt, @updatedAt)
        `),

        deleteSheet: db.prepare(`DELETE FROM music_sheets WHERE id = ?`),

        updateSheet: db.prepare(`
            UPDATE music_sheets SET title = @title, artwork = @artwork, description = @description,
                sort_order = @sortOrder, updated_at = @updatedAt
            WHERE id = @id
        `),

        // ─── 歌曲 ────────────────────────────

        upsertMusicItem: db.prepare(`
            INSERT INTO music_items (platform, id, title, artist, album, duration, artwork, raw)
            VALUES (@platform, @id, @title, @artist, @album, @duration, @artwork, @raw)
            ON CONFLICT(platform, id) DO UPDATE SET
                title = excluded.title,
                artist = excluded.artist,
                album = excluded.album,
                duration = excluded.duration,
                artwork = COALESCE(excluded.artwork, artwork),
                raw = COALESCE(excluded.raw, raw)
        `),

        /** 全量加载歌单内歌曲（slim 列，不含 raw；含 $slim 标记供 upsert 判断） */
        getSheetMusicSlim: db.prepare(`
            SELECT m.platform, CAST(m.id AS TEXT) AS id, m.title, m.artist, m.album, m.duration, m.artwork,
                   1 AS "$slim"
            FROM music_items m
            JOIN sheet_music_relation r ON m.platform = r.platform AND m.id = r.music_id
            WHERE r.sheet_id = ?
            ORDER BY r.sort_order ASC
        `),

        /** 单条获取完整 raw JSON */
        getMusicItemRaw: db.prepare(`
            SELECT raw FROM music_items WHERE platform = ? AND id = ?
        `),

        getSheetMusicCount: db.prepare(`
            SELECT COUNT(*) AS count FROM sheet_music_relation WHERE sheet_id = ?
        `),

        // ─── 关联 ────────────────────────────

        insertRelation: db.prepare(`
            INSERT OR IGNORE INTO sheet_music_relation (sheet_id, platform, music_id, sort_order, added_at)
            VALUES (@sheetId, @platform, @musicId, @sortOrder, @addedAt)
        `),

        removeRelation: db.prepare(`
            DELETE FROM sheet_music_relation
            WHERE sheet_id = @sheetId AND platform = @platform AND music_id = @musicId
        `),

        clearSheetRelations: db.prepare(`
            DELETE FROM sheet_music_relation WHERE sheet_id = ?
        `),

        getMaxSortOrder: db.prepare(`
            SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
            FROM sheet_music_relation WHERE sheet_id = ?
        `),

        getMinSortOrder: db.prepare(`
            SELECT COALESCE(MIN(sort_order), 0) AS minOrder
            FROM sheet_music_relation WHERE sheet_id = ?
        `),

        /** 更新关联的排序（单条） */
        updateRelationOrder: db.prepare(`
            UPDATE sheet_music_relation SET sort_order = @sortOrder
            WHERE sheet_id = @sheetId AND platform = @platform AND music_id = @musicId
        `),

        // ─── 星标远程歌单 ────────────────────

        getAllStarredSheets: db.prepare(`
            SELECT * FROM starred_sheets ORDER BY sort_order ASC, starred_at DESC
        `),

        insertStarredSheet: db.prepare(`
            INSERT OR REPLACE INTO starred_sheets (platform, id, title, artwork, raw, sort_order, starred_at)
            VALUES (@platform, @id, @title, @artwork, @raw, @sortOrder, @starredAt)
        `),

        deleteStarredSheet: db.prepare(`
            DELETE FROM starred_sheets WHERE platform = @platform AND id = @id
        `),

        updateStarredOrder: db.prepare(`
            UPDATE starred_sheets SET sort_order = @sortOrder WHERE platform = @platform AND id = @id
        `),

        // ─── 导出 ────────────────────────────

        /** 某歌单内全量 raw（导出用） */
        getSheetMusicRaw: db.prepare(`
            SELECT m.raw
            FROM music_items m
            JOIN sheet_music_relation r ON m.platform = r.platform AND m.id = r.music_id
            WHERE r.sheet_id = ? AND m.raw IS NOT NULL
            ORDER BY r.sort_order ASC
        `),

        // ─── 孤儿清理 ────────────────────────

        /** 删除不被任何歌单引用的歌曲 */
        cleanOrphanMusic: db.prepare(`
            DELETE FROM music_items
            WHERE (platform, id) NOT IN (
                SELECT DISTINCT platform, music_id FROM sheet_music_relation
            )
        `),

        // ─── 播放队列 ───────────────────────

        /** 获取指定歌单中排在第 N 位（0-based）的 sort_order 值 */
        getSortOrderAtPosition: db.prepare(`
            SELECT sort_order AS sortOrder
            FROM sheet_music_relation
            WHERE sheet_id = ?
            ORDER BY sort_order ASC
            LIMIT 1 OFFSET ?
        `),

        /** 批量后移：将 sort_order >= @pivotOrder 的记录后移 @count 个位置 */
        shiftRelationsAfter: db.prepare(`
            UPDATE sheet_music_relation
            SET sort_order = sort_order + @count
            WHERE sheet_id = @sheetId AND sort_order >= @pivotOrder
        `),

        /** 从源歌单 relation 直接复制到播放队列（零数据传输优化） */
        copyRelationsToQueue: db.prepare(`
            INSERT INTO sheet_music_relation (sheet_id, platform, music_id, sort_order, added_at)
            SELECT @queueId, platform, music_id, sort_order, @addedAt
            FROM sheet_music_relation
            WHERE sheet_id = @fromSheetId
            ORDER BY sort_order ASC
        `),

        /** 从所有歌单中移除歌曲（排除播放队列，由 trackPlayer 自行管理） */
        removeFromAllSheets: db.prepare(`
            DELETE FROM sheet_music_relation
            WHERE platform = @platform AND music_id = @musicId
              AND sheet_id != @excludeSheetId
        `),
    };
}

export type IMusicSheetQueries = ReturnType<typeof createQueries>;
