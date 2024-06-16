import type { Database } from "better-sqlite3";

const validTableNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function checkTableName(tableName: string) {
  if (!validTableNameRegex.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
}

/**
 *
 * @param database Database Instance
 * @param tableName tableName
 * @returns
 */
export function isTableExist(database: Database, tableName: string) {
  return !!database
    .prepare<string, { cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name=?"
    )
    .get(tableName).cnt;
}

export function createMusicListTable(database: Database, tableName: string) {
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
