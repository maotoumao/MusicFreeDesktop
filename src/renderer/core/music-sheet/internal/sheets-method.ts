import {
  localPluginName,
  sortIndexSymbol,
  timeStampSymbol,
} from "@/common/constant";
import { nanoid } from "nanoid";
import musicSheetDB from "./db";
import { musicSheetsStore } from "./store";
import { produce } from "immer";
import defaultSheet from "./default-sheet";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";

// 默认歌单，快速判定是否在列表中
const favoriteMusicListIds = new Set<string>();

export async function initSheets() {
  try {
    const allSheets = await musicSheetDB.sheets.toArray();
    if (
      allSheets.length === 0 ||
      allSheets.findIndex((item) => item.id === defaultSheet.id) === -1
    ) {
      await musicSheetDB.transaction(
        "readwrite",
        musicSheetDB.sheets,
        async () => {
          musicSheetDB.sheets.put(defaultSheet);
        }
      );
      musicSheetsStore.setValue([defaultSheet, ...allSheets]);
    } else {
      musicSheetsStore.setValue(allSheets);
    }
  } catch (e) {
    console.log(e);
  }
}

// 添加新歌单
export async function addSheet(sheetName: string) {
  const id = nanoid();
  const newSheet: IMusic.IMusicSheetItem = {
    id,
    title: sheetName,
    createAt: Date.now(),
    platform: localPluginName,
    musicList: [],
  };
  try {
    await musicSheetDB.transaction(
      "readwrite",
      musicSheetDB.sheets,
      async () => {
        musicSheetDB.sheets.put(newSheet);
      }
    );
    musicSheetsStore.setValue((prev) => [...prev, newSheet]);
  } catch {
    throw new Error("新建失败");
  }
}

export async function getAllSheets() {
  try {
    const allSheets = await musicSheetDB.sheets.toArray();
    musicSheetsStore.setValue(allSheets);
  } catch (e) {
    console.log(e);
  }
}

/** 更新 */
export async function updateSheet(
  sheetId: string,
  newData: IMusic.IMusicSheetItem
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
    musicSheetsStore.setValue(
      produce((draft) => {
        const currentIndex = musicSheetsStore
          .getValue()
          .findIndex((_) => _.id === sheetId);
        if (currentIndex === -1) {
          draft.push(newData);
        } else {
          draft[currentIndex] = {
            ...draft[currentIndex],
            ...newData,
          };
        }
      })
    );
  } catch (e) {
    console.log(e);
  }
}

export async function removeSheet(sheetId: string) {
  try {
    if (sheetId === defaultSheet.id) {
      return;
    }
    await musicSheetDB.transaction(
      "readwrite",
      musicSheetDB.sheets,
      async () => {
        musicSheetDB.sheets.delete(sheetId);
      }
    );
    musicSheetsStore.setValue((prev) =>
      prev.filter((item) => item.id !== sheetId)
    );
  } catch (e) {
    console.log(e);
  }
}

/************* 歌曲 ************/
export async function addMusicToSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  try {
    // 当前的列表
    const targetSheet = musicSheetsStore
      .getValue()
      .find((item) => item.id === sheetId);
    if (!targetSheet) {
      return;
    }
    // 筛选出不在列表中的项目
    const targetMusicList = targetSheet.musicList;
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
            mi.$$ref += 1;
          } else {
            allMusic[index] = {
              ...validMusicItems[index],
              $$ref: 1,
            };
          }
        });
        await musicSheetDB.musicStore.bulkPut(allMusic);
        const timeStamp = Date.now();
        await musicSheetDB.sheets
          .where("id")
          .equals(sheetId)
          .modify((obj) => {
            obj.musicList = [
              ...(obj.musicList ?? []),
              ...validMusicItems.map((item, index) => ({
                platform: item.platform,
                id: item.id,
                [sortIndexSymbol]: index,
                [timeStampSymbol]: timeStamp,
              })),
            ];
            targetSheet.musicList = obj.musicList;
          });
      }
    );

    if (sheetId === defaultSheet.id) {
      _musicItems.forEach((mi) => {
        favoriteMusicListIds.add(getMediaPrimaryKey(mi));
      });
    }
  } catch {
    console.log("error!!")
  }
}

export async function getSheetDetail(
  sheetId: string
): Promise<IMusic.IMusicSheetItem | null> {
  return await musicSheetDB.transaction(
    "readonly",
    musicSheetDB.musicStore,
    async () => {
      const targetSheet = musicSheetsStore
        .getValue()
        .find((item) => item.id === sheetId);
      if (!targetSheet) {
        return null;
      }
      const musicList = targetSheet.musicList ?? [];
      const musicDetailList = await musicSheetDB.musicStore.bulkGet(
        musicList.map((item) => [item.platform, item.id])
      );
      targetSheet.musicList = musicList.map((mi, index) => ({
        ...mi,
        ...musicDetailList[index],
      }));
      return targetSheet as IMusic.IMusicSheetItem;
    }
  );
}



export async function removeMusicFromSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  // 寻找引用
}

// let c = 0;
// export async function test() {
//     ++c;
//   await musicSheetDB.transaction(
//     "rw",
//     musicSheetDB.musicStore,
//     musicSheetDB.sheets,
//     async () => {
//       // 寻找已入库的音乐项目
//       musicSheetDB.musicStore.update({
//         platform: "test",
//         id: "001",
//         ref: Math.random(),
//         fixed: c === 1 ? "fixed!!!" : undefined
//       } as any);
//     }
//   );
// }

export async function isFavoriteMusic(musicItem: IMusic.IMusicItem) {
  return favoriteMusicListIds.has(getMediaPrimaryKey(musicItem));
}
