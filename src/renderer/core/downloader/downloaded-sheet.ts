import {
  getInternalData,
  getMediaPrimaryKey,
  isSameMedia,
  setInternalData,
} from "@/common/media-util";
import Store from "@/common/store";
import {
  getUserPerferenceIDB,
  setUserPerferenceIDB,
} from "@/renderer/utils/user-perference";
import musicSheetDB from "../music-sheet/internal/db";
import { internalDataKey, musicRefSymbol } from "@/common/constant";
import { useEffect, useState } from "react";
import Evt from "../events";

const downloadedMusicListStore = new Store<IMusic.IMusicItem[]>([]);
const downloadedSet = new Set<string>();

// 在初始化歌单时一起初始化
export async function setupDownloadedMusicList() {
  const downloadedPKs = (await getUserPerferenceIDB("downloadedList")) ?? [];
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
      Evt.emit("MUSIC_DOWNLOADED", allMusic);
      setUserPerferenceIDB(
        "downloadedList",
        downloadedMusicListStore.getValue().map(primaryKeyMap)
      );
    });
  } catch {
    console.log("error!!");
  }
}

export async function removeDownloadedMusic(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  removeFile = false
) {
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];

  try {
    await musicSheetDB.transaction("rw", musicSheetDB.musicStore, async () => {
      // 寻找引用
      const toBeRemovedMusicDetail = await musicSheetDB.musicStore.bulkGet(
        _musicItems.map((item) => [item.platform, item.id])
      );
      const needDelete: any[] = [];
      const needUpdate: any[] = [];
      await Promise.all(
        toBeRemovedMusicDetail.map(async (musicItem) => {
          if (!musicItem) {
            return;
          }
          // 1. 如果要删除本地文件
          if (removeFile) {
            const internalPath = getInternalData<IMusic.IMusicItemInternalData>(
              musicItem,
              "downloadData"
            )?.path;
            const rmResult = await window.rimraf(internalPath);
            if (!rmResult) {
              return;
            }
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
              null
            );
            needUpdate.push(musicItem);
          }
        })
      );
      await musicSheetDB.musicStore.bulkDelete(needDelete);
      await musicSheetDB.musicStore.bulkPut(needUpdate);

      downloadedMusicListStore.setValue((prev) =>
        prev.filter(
          (it) => -1 === _musicItems.findIndex((_) => isSameMedia(_, it))
        )
      );
      // 触发事件
      Evt.emit("MUSIC_REMOVE_DOWNLOADED", _musicItems);
      _musicItems.forEach((it) => {
        downloadedSet.delete(getMediaPrimaryKey(it));
      });
      setUserPerferenceIDB(
        "downloadedList",
        downloadedMusicListStore.getValue()
      );
    });
  } catch (e) {
    console.log(e);
    throw e;
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

    Evt.on("MUSIC_DOWNLOADED", dlCb);
    Evt.on("MUSIC_REMOVE_DOWNLOADED", rmCb);

    return () => {
      Evt.off("MUSIC_DOWNLOADED", dlCb);
      Evt.off("MUSIC_REMOVE_DOWNLOADED", rmCb);
    };
  }, [musicItem]);

  return downloaded;
}
