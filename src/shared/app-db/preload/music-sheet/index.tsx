import { localPluginName } from "@/common/constant";
import { safeParse, safeStringify } from "@/common/safe-serialization";
import { customAlphabet } from "nanoid";
import database from "../db";
import utils from "../utils";

const nanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890",
  12
);

const defaultSheet = {
  id: "favorite",
  title: "我喜欢",
  platform: localPluginName,
};

function getAllSheets(): Array<Omit<IMusic.IMusicSheetItem, "musicList">> {
  return database
    .prepare(
      `SELECT * from "main"."${utils.LocalSheetsTableName}"
     ORDER BY 
     "$sortIndex" ASC`
    )
    .all();
}

function getSheetMusicList(
  sheetId: string,
  desc?: boolean
): Array<IMusic.IMusicItem> {
  try {
    const sql = database.prepare<[], IMusic.IMusicItem>(
      `SELECT * from "main"."${`${utils.SheetMusicListTableNamePrefix}${sheetId}`}"
            ORDER BY
            "$sortIndex" ${desc ? "DESC" : "ASC"}
            `
    );
    return sql.all().map((it: any) => ({
      ...it,
      $raw: safeParse(it.raw),
    }));
  } catch (e) {
    console.error("getSheetDetail", e);
    return [];
  }
}

function getSheetItem(sheetId: string): IMusic.IMusicSheetItem | null {
  try {
    const queryMusicListSql = database.prepare<[], IMusic.IMusicItem>(
      `SELECT * from "main"."${`${utils.SheetMusicListTableNamePrefix}${sheetId}`}"
            ORDER BY
            "$sortIndex" DESC
            `
    );
    const sheetItem = database
      .prepare<[string], IMusic.IMusicSheetItem>(
        "SELECT * from \"main\".\"localMusicSheets\" where id = ?"
      )
      .get(sheetId);
    return {
      platform: sheetItem.platform,
      id: sheetItem.id,
      title: sheetItem.title,
      artwork: sheetItem.artwork,
      description: sheetItem.description,
      createAt: sheetItem.createAt,
      musicList: queryMusicListSql.all().map((it: any) => ({
        ...it,
        $raw: safeParse(it.raw),
      })),
      worksNum: sheetItem.worksNum,
    };
  } catch {
    return null;
  }
}

function createSheet(sheetName: string) {
  try {
    const sql = database.transaction((sheetName: string) => {
      // 1. 获取index
      const nextSortIndex =
        (database
          .prepare<[], { maxSortIndex: number }>(
            `
                SELECT MAX("$sortIndex") as maxSortIndex from "main"."localMusicSheets"
            `
          )
          .get().maxSortIndex || 0) + 10;
      // 2. 创建表
      const sheetId = nanoid();
      database
        .prepare(
          `
            INSERT INTO "main"."localMusicSheets" (platform, id, title, artwork, description, createAt, "$sortIndex", worksNum, extra) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          localPluginName,
          sheetId,
          sheetName,
          null,
          null,
          Date.now(),
          nextSortIndex,
          0,
          null
        );
      // 3. 创建详情表
      utils.createMusicListTable(
        database,
        `${utils.SheetMusicListTableNamePrefix}${sheetId}`
      );

      return sheetId;
    });

    return sql(sheetName);
  } catch (e) {
    console.error("CREATE ERROR", e);
    return null;
  }
}

function removeSheet(sheetId: string) {
  if (sheetId === defaultSheet.id) {
    return false;
  }
  try {
    utils.checkTableName(sheetId);

    const sql = database.transaction((sheetId) => {
      database
        .prepare(
          `
               DELETE FROM "main"."localMusicSheets"
               WHERE id=?
            `
        )
        .run(sheetId);

      database
        .prepare(
          `
            DROP TABLE "main"."${`${utils.SheetMusicListTableNamePrefix}${sheetId}`}";
            `
        )
        .run();
    });
    sql(sheetId);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**************************** 歌曲相关方法 ************************/
async function addMusicToSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  try {
    const tableName = `${utils.SheetMusicListTableNamePrefix}${sheetId}`;
    const upsertSql = database.prepare<IMusic.IMusicItem, void>(
      `
            INSERT INTO "main"."${tableName}" (platform, id, title, artist, artwork, url, lrc, album, extra, "$sortIndex", "$raw")
            VALUES (@platform, @id, @title, @artist, @artwork, @url, @lrc, @album, @extra, @sortIndex, @raw)
            ON CONFLICT (platform, id) DO NOTHING
            `
    );
    const updateMusicSheetDataSql = database.prepare<[], void>(`
    UPDATE "main"."localMusicSheets"
    SET
      worksNum = (SELECT COUNT(*) FROM "main"."${tableName}"),
      artwork = (SELECT artwork FROM "main"."${tableName}" ORDER BY "$sortIndex" DESC LIMIT 1)
    WHERE id = '${sheetId}'
  `);
    let nextSortIndex =
      (database
        .prepare<[], { maxSortIndex: number }>(
          `
            SELECT MAX("$sortIndex") as maxSortIndex from "main"."${tableName}"
        `
        )
        .get().maxSortIndex || 0) + 10;

    database.transaction((musicItems: IMusic.IMusicItem[]) => {
      // 插入
      musicItems.forEach((it) => {
        const result = upsertSql.run({
          platform: it.platform,
          id: `${it.id}`,
          title: it.title || null,
          artist: it.artist || null,
          artwork: it.artwork || null,
          url: it.url || null,
          lrc: it.lrc || null,
          album: it.album || null,
          extra: null,
          raw: safeStringify(it),
          sortIndex: nextSortIndex,
        });

        if (result.changes) {
          nextSortIndex += 10;
        }
      });

      updateMusicSheetDataSql.run();
    })(_musicItems);
    return true;
  } catch (e) {
    console.error("ADD FAIL", e);
    return false;
  }
}

function removeMusicFromSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  try {
    const tableName = `${utils.SheetMusicListTableNamePrefix}${sheetId}`;
    const deleteSheetSql = database.prepare<[string, string]>(
      `
           DELETE FROM "main"."${tableName}"
           WHERE platform=? AND id=?
        `
    );
    const updateMusicSheetDataSql = database.prepare<[], void>(`
    UPDATE "main"."localMusicSheets"
    SET
      worksNum = (SELECT COUNT(*) FROM "main"."${tableName}"),
      artwork = (SELECT artwork FROM "main"."${tableName}" ORDER BY "$sortIndex" DESC LIMIT 1)
    WHERE id = '${sheetId}'
  `);
    database.transaction((musicItems: IMusic.IMusicItem[]) => {
      // 插入
      musicItems.forEach((it) => {
        deleteSheetSql.run(it.platform, it.id);
      });
      // 更新基础信息
      updateMusicSheetDataSql.run();
    })(_musicItems);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function removeAllMusic(sheetId: string) {
  try {
    const tableName = `${utils.SheetMusicListTableNamePrefix}${sheetId}`;
    const deleteSheetSql = database.prepare(
      `
           DELETE FROM "main"."${tableName}"
        `
    );
    const updateMusicSheetDataSql = database.prepare<[], void>(`
    UPDATE "main"."localMusicSheets"
    SET
      worksNum = 0,
      artwork = NULL
  `);
    database.transaction(() => {
      deleteSheetSql.run();
      updateMusicSheetDataSql.run();
    })();
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function test() {
  const a = database
    .prepare<string[], void>(
      `
            INSERT INTO "main"."${utils.DefaultSheetMusicListTableName}" (platform, id, title, artist, artwork, url, lrc, album, extra)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (platform, id) DO NOTHING
            `
    )
    .run(
      "platform",
      "13d",
      "" + Math.random(),
      null,
      null,
      null,
      null,
      null,
      null
    );
  console.log(a);
}

export default {
  getSheetMusicList,
  getSheetItem,
  getAllSheets,
  createSheet,
  removeSheet,
  addMusicToSheet,
  removeMusicFromSheet,
  removeAllMusic,
  test,
};
