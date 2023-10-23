import {
  getInternalData,
  getMediaPrimaryKey,
  setInternalData,
} from "@/common/media-util";
import { LRUCache } from "lru-cache";
import {
  callPluginDelegateMethod,
  getPluginPrimaryKey,
} from "../plugin-delegate";
import musicSheetDB from "../db/music-sheet-db";

const linkLyricCache = new LRUCache({
  max: 500,
  allowStale: false,
});

const linkLyricKey = "associatedLrc";

export async function linkLyric(
  from: IMusic.IMusicItem,
  to: IMusic.IMusicItem
) {
  // 如果歌曲已经入库，更新数据库中的meta信息
  const filteredMusicItem: IMedia.IUnique = {
    platform: to.platform,
    id: to.id,
  };
  for (const toPk of getPluginPrimaryKey(to)) {
    filteredMusicItem[toPk] = to[toPk];
  }
  const fromPk = getMediaPrimaryKey(from);
  linkLyricCache.set(fromPk, filteredMusicItem);

  try {
    await musicSheetDB.transaction("rw", musicSheetDB.musicStore, async () => {
      const musicItem = await musicSheetDB.musicStore.get([
        from.platform,
        from.id,
      ]);
      if (musicItem) {
        await musicSheetDB.musicStore.put(
          setInternalData(musicItem, linkLyricKey, filteredMusicItem, true)
        );
      }
    });
  } catch (e) {
    console.log(e);
  }
}

export async function unlinkLyric(musicItem: IMusic.IMusicItem) {
  const pk = getMediaPrimaryKey(musicItem);
  const cachedItem = linkLyricCache.get(pk);
  if (cachedItem) {
    linkLyricCache.delete(pk);
  }

  try {
    await musicSheetDB.transaction("rw", musicSheetDB.musicStore, async () => {
      const dbMusicItem = await musicSheetDB.musicStore.get([
        musicItem.platform,
        musicItem.id,
      ]);
      if (dbMusicItem) {
        await musicSheetDB.musicStore.put(
          setInternalData(dbMusicItem, linkLyricKey, undefined, true)
        );
      }
    });
  } catch {}
}

export async function getLinkedLyric(musicItem: IMusic.IMusicItem) {
  const pk = getMediaPrimaryKey(musicItem);

  const cachedItem = linkLyricCache.get(pk);

  if (cachedItem) {
    return cachedItem as IMusic.IMusicItem;
  }
  try {
    const result = await musicSheetDB.transaction(
      "r",
      musicSheetDB.musicStore,
      async () => {
        const dbMusicItem = await musicSheetDB.musicStore.get([
          musicItem.platform,
          musicItem.id,
        ]);
        if (dbMusicItem) {
          const linkedLyric = getInternalData(dbMusicItem, linkLyricKey);
          return linkedLyric;
        }
      }
    );
    if (result) {
      linkLyricCache.set(pk, result);
      return result;
    }
  } catch (e) {
    console.log(e);
  }
  return null;
}
