import {
  getInternalData,
  getMediaPrimaryKey,
  isSameMedia,
  setInternalData,
} from "@/common/media-util";
import Store from "@/common/store";
import {
  getUserPreferenceIDB,
  setUserPreferenceIDB,
} from "@/renderer/utils/user-perference";
import musicSheetDB from "../db/music-sheet-db";
import { internalDataKey, musicRefSymbol } from "@/common/constant";
import { useEffect, useState } from "react";
import { DownloadEvts, ee } from "./ee";

const downloadedMusicListStore = new Store<IMusic.IMusicItem[]>([]);
const downloadedSet = new Set<string>();

// 在初始化歌单时一起初始化
export async function setupDownloadedMusicList() {
  const downloadedPKs = (await getUserPreferenceIDB("downloadedList")) ?? [];
  downloadedMusicListStore.setValue(await getDownloadedDetails(downloadedPKs));
  downloadedPKs.forEach((it) => {
    downloadedSet.add(getMediaPrimaryKey(it));
  });
}

async function getDownloadedDetails(mediaBases: IMedia.IMediaBase[]) {
  return await musicSheetDB.transaction(
    "readonly",
    musicSheetDB.musicStore,
    async () => {
      const musicDetailList = await musicSheetDB.musicStore.bulkGet(
        mediaBases.map((item) => [item.platform, item.id])
      );

      return musicDetailList;
    }
  );
}

function primaryKeyMap(media: IMedia.IMediaBase) {
  return {
    platform: media.platform,
    id: media.id,
  };
}

// 添加到已下载完成的列表中
export async function addDownloadedMusicToList(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  try {
    // 筛选出不在列表中的项目
    const targetMusicList = downloadedMusicListStore.getValue();
    const validMusicItems = _musicItems.filter(
      (item) => -1 === targetMusicList.findIndex((mi) => isSameMedia(mi, item))
    );

    await musicSheetDB.transaction("rw", musicSheetDB.musicStore, async () => {
      // 寻找已入库的音乐项目
      const allMusic = await musicSheetDB.musicStore.bulkGet(
        validMusicItems.map((item) => [item.platform, item.id])
      );
      allMusic.forEach((mi, index) => {
        if (mi) {
          mi[musicRefSymbol] += 1;
          mi[internalDataKey] = {
            ...(mi[internalDataKey] ?? {}),
            ...(validMusicItems[index][internalDataKey] ?? {}),
          };
        } else {
          allMusic[index] = {
            ...validMusicItems[index],
            [musicRefSymbol]: 1,
          };
        }
      });
      await musicSheetDB.musicStore.bulkPut(allMusic);
      downloadedMusicListStore.setValue((prev) => [...prev, ...allMusic]);
      allMusic.forEach((it) => {
        downloadedSet.add(getMediaPrimaryKey(it));
      });
      ee.emit(DownloadEvts.Downloaded, allMusic);
      setUserPreferenceIDB(
        "downloadedList",
        downloadedMusicListStore.getValue().map(primaryKeyMap)
      );
      return true;
    });
  } catch {
    console.log("error!!");
    return false;
  }
}

export async function removeDownloadedMusic(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  removeFile = false
): Promise<ICommon.ICommonReturnType> {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];

  let message: string | null = null;

  try {
    // 1. 获取全部详细信息
    const toBeRemovedMusicDetail = await musicSheetDB.transaction(
      "r",
      musicSheetDB.musicStore,
      async () => {
        return await musicSheetDB.musicStore.bulkGet(
          _musicItems.map((item) => [item.platform, item.id])
        );
      }
    );
    // 2. 删除文件，事务中删除会报错
    let removeResults: boolean[] = [];
    if (removeFile) {
      removeResults = await Promise.all(
        toBeRemovedMusicDetail.map((it) => {
          try {
            return window.rimraf(
              getInternalData<IMusic.IMusicItemInternalData>(it, "downloadData")
                ?.path
            );
          } catch (e) {
            // 删除失败
            message = "部分歌曲删除失败 " + (e?.message ?? "");
            return false;
          }
        })
      );
    }
    // 3. 修改数据库
    await musicSheetDB.transaction("rw", musicSheetDB.musicStore, async () => {
      const needDelete: any[] = [];
      const needUpdate: any[] = [];
      await Promise.all(
        toBeRemovedMusicDetail.map(async (musicItem, index) => {
          if (!musicItem) {
            return;
          }
          // 1. 如果本地文件删除失败
          if (removeFile && !removeResults[index]) {
            return;
          }
          // 只从歌单中删除，引用-1
          musicItem[musicRefSymbol]--;
          if (musicItem[musicRefSymbol] === 0) {
            needDelete.push([musicItem.platform, musicItem.id]);
          } else {
            // 清空下载
            setInternalData<IMusic.IMusicItemInternalData>(
              musicItem,
              "downloadData",
              undefined
            );
            needUpdate.push(musicItem);
          }
        })
      );
      console.log(needUpdate);
      await musicSheetDB.musicStore.bulkDelete(needDelete);
      await musicSheetDB.musicStore.bulkPut(needUpdate);

      downloadedMusicListStore.setValue((prev) =>
        prev.filter(
          (it) => -1 === _musicItems.findIndex((_) => isSameMedia(_, it))
        )
      );
      // 触发事件
      ee.emit(DownloadEvts.RemoveDownload, _musicItems);
      _musicItems.forEach((it) => {
        downloadedSet.delete(getMediaPrimaryKey(it));
      });
      setUserPreferenceIDB(
        "downloadedList",
        downloadedMusicListStore.getValue()
      );
    });
  } catch (e) {
    message = "删除失败 " + e?.message ?? "";
  }
  if (message) {
    return [
      false,
      {
        msg: message,
      },
    ];
  } else {
    return [true];
  }
}

export function isDownloaded(musicItem: IMedia.IMediaBase) {
  return musicItem ? downloadedSet.has(getMediaPrimaryKey(musicItem)) : false;
}

export const useDownloadedMusicList = downloadedMusicListStore.useValue;

export function useDownloaded(musicItem: IMedia.IMediaBase) {
  const [downloaded, setDownloaded] = useState(isDownloaded(musicItem));

  useEffect(() => {
    const dlCb = (musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) => {
      if (Array.isArray(musicItems)) {
        setDownloaded(
          (prev) =>
            prev ||
            musicItems.findIndex((it) => isSameMedia(it, musicItem)) !== -1
        );
      } else {
        setDownloaded((prev) => prev || isSameMedia(musicItem, musicItems));
      }
    };

    const rmCb = (musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) => {
      if (Array.isArray(musicItems)) {
        setDownloaded(
          (prev) =>
            prev &&
            musicItems.findIndex((it) => isSameMedia(it, musicItem)) === -1
        );
      } else {
        setDownloaded((prev) => prev && !isSameMedia(musicItem, musicItems));
      }
    };

    if (musicItem) {
      setDownloaded(isDownloaded(musicItem));
    }

    ee.on(DownloadEvts.Downloaded, dlCb);
    ee.on(DownloadEvts.RemoveDownload, rmCb);

    return () => {
      ee.off(DownloadEvts.Downloaded, dlCb);
      ee.off(DownloadEvts.RemoveDownload, rmCb);
    };
  }, [musicItem]);

  return downloaded;
}
