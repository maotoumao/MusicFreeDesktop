/**
 * Functional Utils
 */

import type { Database } from "better-sqlite3";

function isTableExist(database: Database, tableName: string) {
  return !!(
    database
      .prepare(
        "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name=?"
      )
      .get(tableName) as any
  ).cnt;
}

const tableNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
function isValidTableName(tableName: string) {
  return tableNameRegex.test(tableName);
}

function checkTableName(tableName: string) {
  if (!isValidTableName(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
}

function createMusicListTable(database: Database, tableName: string) {
  checkTableName(tableName);

  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "main"."${tableName}" (
     "platform" TEXT NOT NULL,
     "id" text NOT NULL,
     "title" TEXT,
     "artist" TEXT,
     "artwork" TEXT,
     "url" TEXT,
     "lrc" TEXT,
     "album" TEXT,
     "extra" TEXT,
     "$sortIndex" INTEGER NOT NULL DEFAULT 0,
     "$raw" TEXT,
     PRIMARY KEY ("platform", "id")
  );`
    )
    .run();
}

/** 本地歌单歌曲列表前缀 */
const SheetMusicListTableNamePrefix = "SHEET_MUSICLIST_";
/** 默认歌单的歌曲列表 */
const DefaultSheetMusicListTableName = "SHEET_MUSICLIST_favorite";
/** 本地歌单的歌曲列表 */
const LocalSheetMusicListTableName = "SHEET_MUSICLIST_local";
/** 本地歌单 */
const LocalSheetsTableName = "localMusicSheets";

export default {
  isTableExist,
  isValidTableName,
  checkTableName,
  createMusicListTable,
  DefaultSheetMusicListTableName,
  LocalSheetMusicListTableName,
  SheetMusicListTableNamePrefix,
  LocalSheetsTableName,
};
