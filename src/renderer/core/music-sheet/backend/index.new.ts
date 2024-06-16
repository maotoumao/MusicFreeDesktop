/**
 * 这里不应该写任何和UI有关的逻辑，只是简单的数据库操作
 *
 * 除了frontend文件夹外，其他任何地方不应该直接调用此处定义的函数
 */

import { isSameMedia } from "@/common/media-util";
import {
  getUserPreferenceIDB,
  setUserPreferenceIDB,
} from "@/renderer/utils/user-perference";
import AppDB from "@/shared/app-db/renderer";
import { getGlobalContext } from "@/shared/global-context/renderer";
import * as Comlink from "comlink";

// 全部的歌单列表(无详情，只有ID)
// 星标的歌单信息
let starredMusicSheets: IMedia.IMediaBase[] = [];

/******************** 方法 ***********************/

export function getAllStarredSheets() {
  return starredMusicSheets;
}

/**
 *
 * 查询所有歌单信息（无详情）
 *
 * @returns 全部歌单信息
 */
export function queryAllSheets() {
  return AppDB.musicSheet.getAllSheets();
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
export function addSheet(sheetName: string) {
  const newSheetId = AppDB.musicSheet.createSheet(sheetName);
  if (newSheetId) {
    return newSheetId;
  } else {
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
  // try {
  //   if (!newData) {
  //     return;
  //   }
  //   await musicSheetDB.transaction(
  //     "readwrite",
  //     musicSheetDB.sheets,
  //     async () => {
  //       musicSheetDB.sheets.update(sheetId, newData);
  //     }
  //   );
  //   musicSheets = produce(musicSheets, (draft) => {
  //     const currentIndex = draft.findIndex((_) => _.id === sheetId);
  //     if (currentIndex === -1) {
  //       draft.push(newData as IMusic.IDBMusicSheetItem);
  //     } else {
  //       draft[currentIndex] = {
  //         ...draft[currentIndex],
  //         ...newData,
  //       };
  //     }
  //   });
  // } catch (e) {
  //   // 更新歌单信息失败
  //   console.log(e);
  // }
}

/**
 * 移除歌单
 * @param sheetId 歌单ID
 * @returns 删除后的ID
 */
export function removeSheet(sheetId: string) {
  return AppDB.musicSheet.removeSheet(sheetId);
}

/**
 * 清空所有音乐
 * @param sheetId 歌单ID
 * @returns 删除后的ID
 */
export function clearSheet(sheetId: string) {
  return AppDB.musicSheet.removeAllMusic(sheetId);
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
export function addMusicToSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  return AppDB.musicSheet.addMusicToSheet(musicItems, sheetId);
}

/**
 * 从歌单内移除歌曲
 * @param musicItems 要移除的歌曲
 * @param sheetId 歌单ID
 * @returns
 */
export function removeMusicFromSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  AppDB.musicSheet.removeMusicFromSheet(musicItems, sheetId);
}

/** 获取歌单内的歌曲详细信息 */
export function getSheetItemMusicList(sheetId: string): IMusic.IMusicItem[] {
  return AppDB.musicSheet.getSheetMusicList(sheetId);
}

const worker = Comlink.wrap(new Worker(getGlobalContext().workersPath.db));

export async function getSheetItemDetail(
  sheetId: string
): Promise<IMusic.IMusicSheetItem | null> {
  const a = Date.now();
  // @ts-ignore
  const R = await worker.getSheetItem(sheetId);
  // const R = AppDB.musicSheet.getSheetItem(sheetId);
  console.log(Date.now() - a);
  return R;
}

/** 导出所有歌单信息 */
export async function exportAllSheetDetails() {
  throw new Error("not implemented");
}
