import database from "../db";
import utils from "../utils";
import { safeParse, safeStringify } from "@/common/safe-serialization";

function getMusicList(desc?: boolean): Array<IMusic.IMusicItem> {
  try {
    const sql = database.prepare<[], IMusic.IMusicItem>(
      `SELECT * from "main"."${utils.LocalSheetMusicListTableName}"
            ORDER BY
            "$sortIndex" ${desc ? "DESC" : "ASC"}
            `
    );
    return sql.all().map((it: any) => ({
      ...it,
      extra: safeParse(it.extra),
    }));
  } catch (e) {
    console.error("getMusicList", e);
    return [];
  }
}

async function addMusicToSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  try {
    const tableName = utils.LocalSheetMusicListTableName;
    const upsertSql = database.prepare<IMusic.IMusicItem, void>(
      `
            INSERT INTO "main"."${tableName}" (platform, id, title, artist, artwork, url, lrc, album, extra, "$sortIndex", "$raw")
            VALUES (@platform, @id, @title, @artist, @artwork, @url, @lrc, @album, @extra, @sortIndex, @raw)
            ON CONFLICT (platform, id) DO NOTHING
            `
    );

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
    })(_musicItems);
    return true;
  } catch (e) {
    console.error("ADD FAIL", e);
    return false;
  }
}

function removeMusicFromSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  try {
    const tableName = utils.LocalSheetMusicListTableName;
    const deleteSheetSql = database.prepare<[string, string]>(
      `
           DELETE FROM "main"."${tableName}"
           WHERE platform=? AND id=?
        `
    );
    database.transaction((musicItems: IMusic.IMusicItem[]) => {
      // 插入
      musicItems.forEach((it) => {
        deleteSheetSql.run(it.platform, it.id);
      });
    })(_musicItems);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export default {
  getMusicList,
  addMusicToSheet,
  removeMusicFromSheet,
};
