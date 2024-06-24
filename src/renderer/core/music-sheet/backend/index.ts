/**
 * 这里不应该写任何和UI有关的逻辑，只是简单的数据库操作
 *
 * 除了frontend文件夹外，其他任何地方不应该直接调用此处定义的函数
 */

import {
  localPluginName,
  musicRefSymbol,
  sortIndexSymbol,
  timeStampSymbol,
} from "@/common/constant";
import { nanoid } from "nanoid";
import musicSheetDB from "../../db/music-sheet-db";
import { produce } from "immer";
import defaultSheet from "../common/default-sheet";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import {
  getUserPreferenceIDB,
  setUserPreferenceIDB,
} from "@/renderer/utils/user-perference";

/******************** 内存缓存 ***********************/
// 默认歌单，快速判定是否在列表中
const favoriteMusicListIds = new Set<string>();
// 全部的歌单列表(无详情，只有ID)
let musicSheets: IMusic.IDBMusicSheetItem[] = [];
// 星标的歌单信息
let starredMusicSheets: IMedia.IMediaBase[] = [];

/******************** 方法 ***********************/

/**
 * 获取全部音乐信息
 * @returns
 */
export function getAllSheets() {
  return musicSheets;
}

export function getAllStarredSheets() {
  return starredMusicSheets;
}

/**
 *
 * 查询所有歌单信息（无详情）
 *
 * @returns 全部歌单信息
 */
export async function queryAllSheets() {
  try {
    // 读取全部歌单
    const allSheets = await musicSheetDB.sheets.toArray();
    const dbDefaultSheet = allSheets.find(
      (item) => item.id === defaultSheet.id
    );
    if (allSheets.length === 0 || !dbDefaultSheet) {
      await musicSheetDB.transaction(
        "readwrite",
        musicSheetDB.sheets,
        async () => {
          musicSheetDB.sheets.put(defaultSheet);
        }
      );
      musicSheets = [defaultSheet, ...allSheets];
    } else {
      dbDefaultSheet.musicList.forEach((mi) => {
        favoriteMusicListIds.add(getMediaPrimaryKey(mi));
      });
      musicSheets = allSheets;
    }
    // 收藏歌单
    return musicSheets;
  } catch (e) {
    console.log(e);
    return musicSheets;
  }
}

/**
 * 查询所有收藏歌单
 * @returns 收藏歌单信息
 */
export async function queryAllStarredSheets() {
  try {
    starredMusicSheets =
      (await getUserPreferenceIDB("starredMusicSheets")) || [];
    return starredMusicSheets;
  } catch {
    return [];
  }
}

/**
 * 新建歌单
 * @param sheetName 歌单名
 * @returns 新建的歌单信息
 */
export async function addSheet(sheetName: string) {
  const id = nanoid();
  const newSheet: IMusic.IMusicSheetItem = {
    id,
    title: sheetName,
    createAt: Date.now(),
    platform: localPluginName,
    musicList: [],
    $$sortIndex: musicSheets[musicSheets.length - 1].$$sortIndex + 1,
  };
  try {
    await musicSheetDB.transaction(
      "readwrite",
      musicSheetDB.sheets,
      async () => {
        musicSheetDB.sheets.put(newSheet);
      }
    );
    musicSheets = [...musicSheets, newSheet];
    return newSheet;
  } catch {
    throw new Error("新建失败");
  }
}

/**
 * 更新歌单信息
 * @param sheetId 歌单ID
 * @param newData 最新的歌单信息
 * @returns
 */
export async function updateSheet(
  sheetId: string,
  newData: Partial<IMusic.IMusicSheetItem>
) {
  try {
    if (!newData) {
      return;
    }
    await musicSheetDB.transaction(
      "readwrite",
      musicSheetDB.sheets,
      async () => {
        musicSheetDB.sheets.update(sheetId, newData);
      }
    );

    musicSheets = produce(musicSheets, (draft) => {
      const currentIndex = draft.findIndex((_) => _.id === sheetId);
      if (currentIndex === -1) {
        draft.push(newData as IMusic.IDBMusicSheetItem);
      } else {
        draft[currentIndex] = {
          ...draft[currentIndex],
          ...newData,
        };
      }
    });
  } catch (e) {
    // 更新歌单信息失败
    console.log(e);
  }
}

/**
 * 移除歌单
 * @param sheetId 歌单ID
 * @returns 删除后的ID
 */
export async function removeSheet(sheetId: string) {
  try {
    if (sheetId === defaultSheet.id) {
      // 默认歌单不可删除
      return;
    }
    await musicSheetDB.transaction(
      "readwrite",
      musicSheetDB.sheets,
      musicSheetDB.musicStore,
      async () => {
        const targetSheet = musicSheets.find((item) => item.id === sheetId);

        await removeMusicFromSheet(
          targetSheet.musicList ?? ([] as any),
          sheetId
        );
        musicSheetDB.sheets.delete(sheetId);
      }
    );
    musicSheets = musicSheets.filter((it) => it.id !== sheetId);
    return musicSheets;
  } catch (e) {
    console.log(e);
  }
}

/**
 * 清空所有音乐
 * @param sheetId 歌单ID
 * @returns 删除后的ID
 */
export async function clearSheet(sheetId: string) {
  try {
    await musicSheetDB.transaction(
      "readwrite",
      musicSheetDB.sheets,
      musicSheetDB.musicStore,
      async () => {
        const targetSheet = musicSheets.find((item) => item.id === sheetId);
        await removeMusicFromSheet(
          targetSheet.musicList ?? ([] as any),
          sheetId
        );
        targetSheet.musicList = [];
      }
    );
    return [...musicSheets];
  } catch (e) {
    console.log(e);
  }
}

/**
 * 收藏歌单
 * @param sheet
 */
export async function starMusicSheet(sheet: IMedia.IMediaBase) {
  const newSheets = [...starredMusicSheets, sheet];
  await setUserPreferenceIDB("starredMusicSheets", newSheets);
  starredMusicSheets = newSheets;
}

/**
 * 取消收藏歌单
 * @param sheet
 */
export async function unstarMusicSheet(sheet: IMedia.IMediaBase) {
  const newSheets = starredMusicSheets.filter(
    (item) => !isSameMedia(item, sheet)
  );
  await setUserPreferenceIDB("starredMusicSheets", newSheets);
  starredMusicSheets = newSheets;
}

/**
 * 收藏歌单排序
 */

export async function setStarredMusicSheets(sheets: IMedia.IMediaBase[]) {
  await setUserPreferenceIDB("starredMusicSheets", sheets);
  starredMusicSheets = sheets;
}

/**************************** 歌曲相关方法 ************************/

/**
 * 添加歌曲到歌单
 * @param musicItems
 * @param sheetId
 * @returns
 */
export async function addMusicToSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  try {
    // 当前的列表
    const targetSheet = musicSheets.find((item) => item.id === sheetId);
    if (!targetSheet) {
      return;
    }
    // 筛选出不在列表中的项目
    const targetMusicList = targetSheet.musicList;
    // 要添加到音乐列表中的项目
    const validMusicItems = _musicItems.filter(
      (item) => -1 === targetMusicList.findIndex((mi) => isSameMedia(mi, item))
    );

    await musicSheetDB.transaction(
      "rw",
      musicSheetDB.musicStore,
      musicSheetDB.sheets,
      async () => {
        // 寻找已入库的音乐项目
        const allMusic = await musicSheetDB.musicStore.bulkGet(
          validMusicItems.map((item) => [item.platform, item.id])
        );
        allMusic.forEach((mi, index) => {
          if (mi) {
            mi[musicRefSymbol] += 1;
          } else {
            allMusic[index] = {
              ...validMusicItems[index],
              [musicRefSymbol]: 1,
            };
          }
        });
        await musicSheetDB.musicStore.bulkPut(allMusic);
        const timeStamp = Date.now();
        await musicSheetDB.sheets
          .where("id")
          .equals(sheetId)
          .modify((obj) => {
            obj.artwork =
              validMusicItems[validMusicItems.length - 1]?.artwork ??
              obj.artwork;
            obj.musicList = [
              ...(obj.musicList ?? []),
              ...validMusicItems.map((item, index) => ({
                platform: item.platform,
                id: item.id,
                [sortIndexSymbol]: index,
                [timeStampSymbol]: timeStamp,
              })),
            ];
            targetSheet.artwork = obj.artwork;
            targetSheet.musicList = obj.musicList;
            musicSheets = [...musicSheets];
          });
      }
    );

    if (sheetId === defaultSheet.id) {
      _musicItems.forEach((mi) => {
        favoriteMusicListIds.add(getMediaPrimaryKey(mi));
      });
    }

    return musicSheets;
  } catch {
    console.log("error!!");
  }
}

/**
 * 从歌单内移除歌曲
 * @param musicItems 要移除的歌曲
 * @param sheetId 歌单ID
 * @returns
 */
export async function removeMusicFromSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  const targetSheet = musicSheets.find((item) => item.id === sheetId);
  if (!targetSheet) {
    return;
  }
  // 重新组装
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  const targetMusicList = targetSheet.musicList ?? [];
  const toBeRemovedMusic: IMedia.IMediaBase[] = [];
  const restMusic: IMedia.IMediaBase[] = [];
  for (const mi of targetMusicList) {
    // 用map会更快吧
    if (_musicItems.findIndex((item) => isSameMedia(mi, item)) === -1) {
      // 剩余的音乐
      restMusic.push(mi);
    } else {
      // 将要删除的音乐
      toBeRemovedMusic.push(mi);
    }
  }

  try {
    await musicSheetDB.transaction(
      "rw",
      musicSheetDB.sheets,
      musicSheetDB.musicStore,
      async () => {
        // 寻找引用
        const toBeRemovedMusicDetail = await musicSheetDB.musicStore.bulkGet(
          toBeRemovedMusic.map((item) => [item.platform, item.id])
        );
        // 如果引用计数为0，进入删除队列
        const needDelete: any[] = [];
        // 如果不为0，进入更新队列
        const needUpdate: any[] = [];
        toBeRemovedMusicDetail.forEach((musicItem) => {
          if (!musicItem) {
            return;
          }
          musicItem[musicRefSymbol]--;
          if (musicItem[musicRefSymbol] === 0) {
            needDelete.push([musicItem.platform, musicItem.id]);
          } else {
            needUpdate.push(musicItem);
          }
        });
        await musicSheetDB.musicStore.bulkDelete(needDelete);
        await musicSheetDB.musicStore.bulkPut(needUpdate);

        // 当前的最后一首歌
        const lastMusic = restMusic[restMusic.length - 1];
        // 更新当前歌单的封面
        let newArtwork: string;
        if (lastMusic) {
          newArtwork = (
            await musicSheetDB.musicStore.get([
              lastMusic.platform,
              lastMusic.id,
            ])
          ).artwork;
        }

        await musicSheetDB.sheets
          .where("id")
          .equals(sheetId)
          .modify((obj) => {
            obj.artwork = newArtwork;
            obj.musicList = restMusic;
            // 修改 MusicSheets
            targetSheet.artwork = newArtwork;
            targetSheet.musicList = obj.musicList;
            musicSheets = [...musicSheets];
          });
      }
    );

    if (sheetId === defaultSheet.id) {
      // 从默认歌单里删除
      toBeRemovedMusic.forEach((mi) => {
        favoriteMusicListIds.delete(getMediaPrimaryKey(mi));
      });
    }
  } catch (e) {
    console.log(e);
    throw e;
  }
}

/** 获取歌单内的歌曲详细信息 */
export async function getSheetItemDetail(
  sheetId: string
): Promise<IMusic.IMusicSheetItem | null> {
  // 取太多歌曲时会卡顿， 1000首歌大约100ms
  const targetSheet = musicSheets.find((item) => item.id === sheetId);
  if (!targetSheet) {
    return null;
  }
  const tmpResult = [];
  const musicList = targetSheet.musicList ?? [];
  // 一组800个
  const groupSize = 800;
  const groupNum = Math.ceil(musicList.length / groupSize);

  for (let i = 0; i < groupNum; ++i) {
    const sliceResult = await musicSheetDB.transaction(
      "readonly",
      musicSheetDB.musicStore,
      async () => {
        return await musicSheetDB.musicStore.bulkGet(
          musicList
            .slice(i * groupSize, (i + 1) * groupSize)
            .map((item) => [item.platform, item.id])
        );
      }
    );

    tmpResult.push(...(sliceResult ?? []));
  }

  return {
    ...targetSheet,
    musicList: tmpResult,
  } as IMusic.IMusicSheetItem;
}

/**
 * 某首歌是否被标记为喜欢
 * @param musicItem
 * @returns
 */
export function isFavoriteMusic(musicItem: IMusic.IMusicItem) {
  return favoriteMusicListIds.has(getMediaPrimaryKey(musicItem));
}

/** 导出所有歌单信息 */
export async function exportAllSheetDetails() {
  return await musicSheetDB.transaction(
    "readonly",
    musicSheetDB.musicStore,
    async () => {
      const allSheets = musicSheets;
      if (!allSheets) {
        return [];
      }
      const musicLists = await Promise.all(
        allSheets.map((sheet) =>
          musicSheetDB.musicStore.bulkGet(
            (sheet.musicList ?? []).map((item) => [item.platform, item.id])
          )
        )
      );

      const allSheetDetails = produce(allSheets, (draft) => {
        draft.forEach((sheet, index) => {
          sheet.musicList = musicLists[index];
        });
      });

      return allSheetDetails;
    }
  );
}
