import Store from "@/common/store";
import * as backend from "../backend/index.new";
import defaultSheet from "../common/default-sheet";
import { useEffect, useRef, useState } from "react";
import { RequestStateCode, localPluginName } from "@/common/constant";
import { toMediaBase } from "@/common/media-util";
import EventEmitter from "eventemitter3";
import { createUniqueMap } from "@/common/unique-map";

const evtHub = new EventEmitter();

enum EvtNames {
  Favorite_MusicSheet_Change = "Favorite_MusicSheet_Change", // 收藏歌单变化
  MusicSheet_Updated = "MusicSheet_Updated", // 某个歌单更新
}

const musicSheetsStore = new Store<IMusic.IMusicSheetItem[]>([]);
const starredSheetsStore = new Store<IMedia.IMediaBase[]>([]);
const defaultMusicUniqueMap = createUniqueMap();

export const useAllSheets = musicSheetsStore.useValue;
export const useAllStarredSheets = starredSheetsStore.useValue;

export const getAllSheets = musicSheetsStore.getValue;

/** 触发事件的函数 */
/**
 * 重新取歌单状态
 * @param sheetId
 */
async function refetchSheetDetail(sheetId: string) {
  const evtName = EvtNames.MusicSheet_Updated + sheetId;

  if (!evtHub.listenerCount(evtName)) {
    return;
  }
  let sheetDetail = await backend.getSheetItemDetail(sheetId);
  if (!sheetDetail) {
    // 可能已经被删除了
    sheetDetail = {
      id: sheetId,
      title: "已删除歌单",
      artist: "未知作者",
      platform: localPluginName,
    };
  }
  evtHub.emit(evtName, sheetDetail);
}

/**
 * 初始化
 */
export async function setupMusicSheets() {
  const [musicSheets, starredSheets] = await Promise.all([
    backend.queryAllSheets(),
    backend.queryAllStarredSheets(),
  ]);
  musicSheetsStore.setValue(musicSheets);
  starredSheetsStore.setValue(starredSheets);

  const defaultMusicList = backend.getSheetItemMusicList(defaultSheet.id);
  defaultMusicUniqueMap.add(defaultMusicList);
}

function refetchMusicSheets() {
  musicSheetsStore.setValue(backend.queryAllSheets());
}

/**
 * 新建歌单
 * @param sheetName 歌单名
 * @returns 新建的歌单信息
 */
export async function addSheet(sheetName: string) {
  const newSheetId = backend.addSheet(sheetName);
  if (newSheetId) {
    refetchMusicSheets();
  }

  return {
    id: newSheetId,
  };
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
  } catch {}
}

/**
 * 更新歌单中的歌曲顺序
 * @param sheetId
 * @param musicList
 */
export async function updateSheetMusicOrder(
  sheetId: string,
  musicList: IMusic.IMusicItem[]
) {
  try {
    // const targetSheet = musicSheetsStore
    //   .getValue()
    //   .find((it) => it.id === sheetId);
    // updateSheetDetail({
    //   ...targetSheet,
    //   musicList,
    // });
    // await backend.updateSheet(sheetId, {
    //   musicList: musicList.map(toMediaBase) as any,
    // });
    // musicSheetsStore.setValue(backend.getAllSheets());
  } catch {}
}

/**
 * 移除歌单
 * @param sheetId 歌单ID
 * @returns 删除后的ID
 */
export async function removeSheet(sheetId: string) {
  const isSuccess = backend.removeSheet(sheetId);
  if (isSuccess) {
    refetchMusicSheets();
  }
}

/**
 * 清空所有音乐
 * @param sheetId 歌单ID
 * @returns 删除后的ID
 */
export async function clearSheet(sheetId: string) {
  const isSuccess = backend.clearSheet(sheetId);
  if (isSuccess) {
    refetchSheetDetail(sheetId);
  }
}

/**
 * 收藏歌单
 * @param sheet
 */
export async function starMusicSheet(sheet: IMedia.IMediaBase) {
  await backend.starMusicSheet(sheet);
  starredSheetsStore.setValue(backend.getAllStarredSheets());
}

/**
 * 取消收藏歌单
 * @param sheet
 */
export async function unstarMusicSheet(sheet: IMedia.IMediaBase) {
  await backend.unstarMusicSheet(sheet);
  starredSheetsStore.setValue(backend.getAllStarredSheets());
}

/**
 * 收藏歌单排序
 */
export async function setStarredMusicSheets(sheets: IMedia.IMediaBase[]) {
  await backend.setStarredMusicSheets(sheets);
  starredSheetsStore.setValue(backend.getAllStarredSheets());
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
  backend.addMusicToSheet(musicItems, sheetId);

  if (sheetId === defaultSheet.id) {
    defaultMusicUniqueMap.add(musicItems);
    evtHub.emit(EvtNames.Favorite_MusicSheet_Change);
  }
  refetchSheetDetail(sheetId);
}

/** 添加到默认歌单 */
export async function addMusicToFavorite(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  return addMusicToSheet(musicItems, defaultSheet.id);
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
  backend.removeMusicFromSheet(musicItems, sheetId);

  if (sheetId === defaultSheet.id) {
    defaultMusicUniqueMap.remove(musicItems);
    evtHub.emit(EvtNames.Favorite_MusicSheet_Change);
  }
  refetchSheetDetail(sheetId);
}

/** 从默认歌单中移除 */
export async function removeMusicFromFavorite(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  return removeMusicFromSheet(musicItems, defaultSheet.id);
}

/** 是否是我喜欢的歌单 */
export function isFavoriteMusic(musicItem: IMusic.IMusicItem) {
  return defaultMusicUniqueMap.has(musicItem);
}

/** hook 某首歌曲是否被标记成喜欢 */
export function useMusicIsFavorite(musicItem: IMusic.IMusicItem) {
  const [isFav, setIsFav] = useState(isFavoriteMusic(musicItem));

  useEffect(() => {
    const cb = () => {
      console.log("UPDATE");
      setIsFav(isFavoriteMusic(musicItem));
    };
    cb();
    evtHub.on(EvtNames.Favorite_MusicSheet_Change, cb);
    return () => {
      evtHub.off(EvtNames.Favorite_MusicSheet_Change, cb);
    };
  }, [musicItem]);

  return isFav;
}

/**
 * 监听当前某个歌单
 * @param sheetId 歌单ID
 * @param initQuery 是否重新查询
 */
export function useMusicSheet(sheetId: string) {
  const [pendingState, setPendingState] = useState(
    RequestStateCode.PENDING_FIRST_PAGE
  );
  const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>(
    null
  );

  // 实时的sheetId
  const realTimeSheetIdRef = useRef(sheetId);
  realTimeSheetIdRef.current = sheetId;

  const pendingStateRef = useRef(pendingState);
  pendingStateRef.current = pendingState;

  useEffect(() => {
    setPendingState(RequestStateCode.PENDING_FIRST_PAGE);
    const updateSheet = (newSheet: IMusic.IMusicSheetItem) => {
      // 如果更新的是当前歌单，则设置
      if (realTimeSheetIdRef.current === newSheet?.id) {
        setSheetItem(newSheet);
        setPendingState(RequestStateCode.FINISHED);
      }
    };

    const evtName = EvtNames.MusicSheet_Updated + sheetId;

    evtHub.on(evtName, updateSheet);

    const targetSheet = musicSheetsStore
      .getValue()
      .find((item) => item.id === sheetId);

    if (targetSheet) {
      setSheetItem({
        ...targetSheet,
        musicList: [],
      });
    }
    refetchSheetDetail(sheetId);

    return () => {
      evtHub.off(evtName, updateSheet);
    };
  }, [sheetId]);

  return [sheetItem, pendingState] as const;
}

/**
 * 监听当前某个歌单
 * @param sheetId 歌单ID
 * @param initQuery 是否重新查询
 */
// export function useMusicSheet(sheetId: string) {
//   const [pendingState, setPendingState] = useState(
//     RequestStateCode.PENDING_FIRST_PAGE
//   );
//   const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>(
//     null
//   );

//   // 实时的sheetId
//   const realTimeSheetIdRef = useRef(sheetId);
//   realTimeSheetIdRef.current = sheetId;

//   const pendingStateRef = useRef(pendingState);
//   pendingStateRef.current = pendingState;

//   useEffect(() => {
//     const updateSheet = async () => {
//       const start = Date.now();
//       const sheetDetail = await backend.getSheetItemDetail(sheetId);
//       console.log("歌单详情", Date.now() - start, "ms");
//       if (realTimeSheetIdRef.current === sheetId) {
//         console.log("歌单详情", sheetId);
//         setSheetItem(sheetDetail);
//         setPendingState(RequestStateCode.FINISHED);
//       }
//     };

//     const updateSheetCallback = async () => {
//       if (!(pendingStateRef.current & RequestStateCode.LOADING)) {
//         setPendingState(RequestStateCode.PENDING_REST_PAGE);
//         await updateSheet();
//       }
//     };

//     const cbs = updateSheetCbs.get(sheetId) ?? new Set();
//     cbs.add(updateSheetCallback);
//     updateSheetCbs.set(sheetId, cbs);

//     const targetSheet = musicSheetsStore
//       .getValue()
//       .find((item) => item.id === sheetId);

//     if (targetSheet) {
//       setSheetItem({
//         ...targetSheet,
//         musicList: [],
//       });
//     }

//     setPendingState(RequestStateCode.PENDING_FIRST_PAGE);
//     updateSheet();

//     return () => {
//       cbs?.delete(updateSheetCallback);
//     };
//   }, [sheetId]);

//   return [sheetItem, pendingState] as const;
// }

export async function exportAllSheetDetails() {
  return await backend.exportAllSheetDetails();
}
