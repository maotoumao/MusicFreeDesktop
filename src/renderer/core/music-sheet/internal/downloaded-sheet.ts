import {
  getMediaPrimaryKey,
  isSameMedia,
  setInternalData,
} from "@/common/media-util";
import Store from "@/common/store";
import {
  getUserPerferenceIDB,
  setUserPerferenceIDB,
} from "@/renderer/utils/user-perference";
import musicSheetDB from "./db";
import { internalDataKey, musicRefSymbol } from "@/common/constant";

const downloadedMusicListStore = new Store<IMedia.IMediaBase[]>([]);
const downloadedSet = new Set<string>();

export async function setupDownloadedMusicList() {
  const downloaded = (await getUserPerferenceIDB("downloadedList")) ?? [];
  downloadedMusicListStore.setValue(downloaded);
  downloaded.forEach((it) => {
    downloadedSet.add(getMediaPrimaryKey(it));
  });
}

function primaryKeyMap(media: IMedia.IMediaBase) {
    return {
        platform: media.platform,
        id: media.id
    }
}

// 添加到已下载完成的列表中
export async function addDownloadedMusic(
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
      downloadedMusicListStore.setValue((prev) => [...prev, ...(allMusic.map(primaryKeyMap))]);
      allMusic.forEach((it) => {
        downloadedSet.add(getMediaPrimaryKey(it));
      });
      setUserPerferenceIDB(
        "downloadedList",
        downloadedMusicListStore.getValue()
      );
    });
  } catch {
    console.log("error!!");
  }
}

export async function removeDownloadedMusic(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
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
      toBeRemovedMusicDetail.forEach((musicItem) => {
        if (!musicItem) {
          return;
        }
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
      });
      await musicSheetDB.musicStore.bulkDelete(needDelete);
      await musicSheetDB.musicStore.bulkPut(needUpdate);

      downloadedMusicListStore.setValue((prev) =>
        prev.filter(
          (it) => -1 === _musicItems.findIndex((_) => isSameMedia(_, it))
        )
      );

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

export function isDownloadeed(musicItem: IMedia.IMediaBase) {
  return downloadedSet.has(getMediaPrimaryKey(musicItem));
}
