import Database from "better-sqlite3";
import path from "path";
import { getGlobalContext } from "@shared/global-context/preload";
import utils from "./utils";
import { localPluginName } from "@/common/constant";

const globalContext = getGlobalContext();
const dbPath = path.join(globalContext.appPath.userData, "./MusicFreeDB.db");
const database = new Database(dbPath);
database.pragma("journal_mode = WAL");

try {
  // 本地歌单
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "main"."${utils.LocalSheetsTableName}" (
        "platform" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT,
    "artwork" TEXT,
    "description" TEXT,
    "createAt" REAL,
    "$sortIndex" INTEGER,
    "worksNum" INTEGER,
    "extra" TEXT,
    PRIMARY KEY ("id")
  );`
    )
    .run();

  if (
    !database
      .prepare<[], { cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM "main"."${utils.LocalSheetsTableName}"
      WHERE (id = 'favorite');
      `
      )
      .get().cnt
  ) {
    database
      .prepare<[], void>(
        `INSERT INTO "main"."${
          utils.LocalSheetsTableName
        }" (platform, id, title, artwork, description, createAt, "$sortIndex", worksNum, extra)
          VALUES ('${localPluginName}' ,'favorite', 'My Favorite', NULL, NULL, ${Date.now()}, 0, 0, NULL);
        `
      )
      .run();
  }

  // 创建默认歌单详情
  utils.createMusicListTable(database, utils.DefaultSheetMusicListTableName);

  // 本地歌曲详情
  utils.createMusicListTable(database, utils.LocalSheetMusicListTableName);

  // META
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "main"."mediaMeta" (
      "platform" TEXT NOT NULL,
      "id" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT '',
      "meta" TEXT,
      PRIMARY KEY ("platform", "id", "type")
);`
    )
    .run();
} catch (e) {
  console.error("DB INIT FAIL", e);
}

export default database;
