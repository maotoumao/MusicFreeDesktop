/**
 * 这里不应该写任何和UI有关的逻辑，只是简单的数据库操作
 *
 * 除了frontend文件夹外，其他任何地方不应该直接调用此处定义的函数
 */

import { localPluginName, musicRefSymbol, sortIndexSymbol, timeStampSymbol } from "@/common/constant";
import { nanoid } from "nanoid";
import musicSheetDB from "../../db/music-sheet-db";
import { produce } from "immer";
import defaultSheet from "../common/default-sheet";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import { getUserPreferenceIDB, setUserPreferenceIDB } from "@/renderer/utils/user-perference";
import database from "@/shared/database/renderer";
import { safeParse } from "@/common/safe-serialization";
import { delay } from "@/common/time-util";

/******************** 内存缓存 ***********************/
// 默认歌单，快速判定是否在列表中
const favoriteMusicListIds = new Set<string>();
// 全部的歌单列表(无详情，只有ID)
let musicSheets: IDataBaseModel.IMusicSheetModel[] = [];
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
        musicSheets = database.LocalMusicSheetDB.getAllMusicSheets();

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
export async function addSheet(sheetName: string, id: string = nanoid()) {

    const newSheet: IDataBaseModel.IMusicSheetModel = {
        platform: localPluginName,
        id,
        title: sheetName,
        createAt: Date.now(),
        artwork: null,
        description: null,
        worksNum: 0,
        playCount: 0,
        artist: null,
    };
    try {
        database.LocalMusicSheetDB.addMusicSheet({
            ...newSheet,
            _raw: JSON.stringify(newSheet),
        });
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
    newData: Partial<IMusic.IMusicSheetItem>,
) {
    try {
        if (!newData) {
            return;
        }
        
        database.LocalMusicSheetDB.updateMusicSheet(localPluginName, sheetId, newData);

        musicSheets = produce(musicSheets, (draft) => {
            const currentIndex = draft.findIndex((_) => _.id === sheetId);
            if (currentIndex === -1) {
                draft.push(newData as IDataBaseModel.IMusicSheetModel);
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

        database.LocalMusicSheetDB.deleteMusicSheet(localPluginName, sheetId);
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

        database.LocalMusicSheetDB.clearAllMusicItemsInSheet(localPluginName, sheetId);

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
        (item) => !isSameMedia(item, sheet),
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
    sheetId: string,
) {
    if (Array.isArray(musicItems)) {
        const patches: IDataBaseModel.IMusicItemModel[] = musicItems.map(item => ({
            ...item,
            _musicSheetId: sheetId,
            _musicSheetPlatform: localPluginName,
            _timestamp: Date.now(),
            _raw: JSON.stringify(item),
        }));

        database.LocalMusicSheetDB.batchAddMusicItemsToSheet(
            patches,
            localPluginName,
            sheetId,
        );
    } else {
        database.LocalMusicSheetDB.addMusicItemToSheet({
            ...musicItems,
            _musicSheetId: sheetId,
            _musicSheetPlatform: localPluginName,
            _timestamp: Date.now(),
            _raw: JSON.stringify(musicItems),
        }, localPluginName, sheetId);
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
    sheetId: string,
) {

    const targetSheet = musicSheets.find((item) => item.id === sheetId);
    if (!targetSheet) {
        return;
    }

    console.log("删除音乐", musicItems, "from sheet", sheetId);
    if (Array.isArray(musicItems)) {
        database.LocalMusicSheetDB.batchDeleteMusicItemsFromSheet(musicItems, localPluginName, sheetId);
    } else {
        database.LocalMusicSheetDB.deleteMusicItemFromSheet(musicItems.platform, musicItems.id, localPluginName, sheetId);
    }
}

/** 获取歌单内的歌曲详细信息 */
export async function getSheetItemDetail(
    sheetId: string,
): Promise<IMusic.IMusicSheetItem | null> {
    const musicList = database.LocalMusicSheetDB.getMusicItemsInSheet(localPluginName, sheetId);
    // 取太多歌曲时会卡顿， 1000首歌大约100ms
    const targetSheet = musicSheets.find((item) => item.id === sheetId);
    if (!targetSheet) {
        return null;
    }
    const tmpResult = [];
    // 一组800个
    const groupSize = 1600;
    const groupNum = Math.ceil(musicList.length / groupSize);

    for (let i = 0; i < groupNum; ++i) {
        // unpack
        const sliceResult = musicList.slice(
            i * groupSize, i * groupSize + groupSize,
        ).map((item) => ({
            ...(safeParse(item._raw) ?? {}),
            ...item,
            _raw: undefined,
        }));

        tmpResult.push(...(sliceResult ?? []));

        await delay(0); // 让出主线程，避免卡顿
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
    return database.LocalMusicSheetDB.existsMusicItemInSheet(musicItem.platform, "" + musicItem.id, localPluginName, defaultSheet.id);
}

/** 导出所有歌单信息 */
export async function exportAllSheetDetails() {
    // return await musicSheetDB.transaction(
    //     "readonly",
    //     musicSheetDB.musicStore,
    //     async () => {
    //         const allSheets = musicSheets;
    //         if (!allSheets) {
    //             return [];
    //         }
    //         const musicLists = await Promise.all(
    //             allSheets.map((sheet) =>
    //                 musicSheetDB.musicStore.bulkGet(
    //                     (sheet.musicList ?? []).map((item) => [item.platform, item.id]),
    //                 ),
    //             ),
    //         );

    //         const allSheetDetails = produce(allSheets, (draft) => {
    //             draft.forEach((sheet, index) => {
    //                 sheet.musicList = musicLists[index];
    //             });
    //         });

    //         return allSheetDetails;
    //     },
    // );
}
