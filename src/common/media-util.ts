import { produce } from "immer";
import {
  internalSerializeKey,
  localPluginName,
  qualityKeys,
  sortIndexSymbol,
  timeStampSymbol,
} from "./constant";

export function isSameMedia(
  a?: IMedia.IMediaBase | null,
  b?: IMedia.IMediaBase | null
) {
  if (a && b) {
    return a.id === b.id && a.platform === b.platform;
  }
  return false;
}

export function resetMediaItem<T extends IMedia.IMediaBase>(
  mediaItem: T,
  platform?: string,
  newObj?: boolean
): T {
  // 本地音乐不做处理
  if (mediaItem.platform === localPluginName || platform === localPluginName) {
    return newObj ? { ...mediaItem } : mediaItem;
  }
  if (!newObj) {
    mediaItem.platform = platform ?? mediaItem.platform;
    mediaItem[internalSerializeKey] = undefined;
    return mediaItem;
  } else {
    return produce(mediaItem, (_) => {
      _.platform = platform ?? mediaItem.platform;
      _[internalSerializeKey] = undefined;
    });
  }
}

export function getMediaPrimaryKey(mediaItem: IMedia.IMediaBase) {
  return `${mediaItem.platform}@${mediaItem.id}`;
}

export function sortByTimestampAndIndex(array: any[], newArray = false) {
  if (newArray) {
    array = [...array];
  }
  return array.sort((a, b) => {
    const ts = a[timeStampSymbol] - b[timeStampSymbol];
    if (ts !== 0) {
      return ts;
    }
    return a[sortIndexSymbol] - b[sortIndexSymbol];
  });
}

export function addSortProperty(
  mediaItems: IMedia.IMediaBase | IMedia.IMediaBase[]
) {
  const now = Date.now();
  if (Array.isArray(mediaItems)) {
    mediaItems.forEach((item, index) => {
      item[timeStampSymbol] = now;
      item[sortIndexSymbol] = index;
    });
  } else {
    mediaItems[timeStampSymbol] = now;
    mediaItems[sortIndexSymbol] = 0;
  }
}

/**
 *  获取音质顺序
 * 
 * asc: 优先高音质
 * desc：优先低音质
 */
export function getQualityOrder(
  qualityKey: IMusic.IQualityKey,
  sort: "asc" | "desc"
) {
  const idx = qualityKeys.indexOf(qualityKey);
  const left = qualityKeys.slice(0, idx);
  const right = qualityKeys.slice(idx + 1);
  if (sort === "asc") {
    /** 优先高音质 */
    return [qualityKey, ...right, ...left.reverse()];
  } else {
    /** 优先低音质 */
    return [qualityKey, ...left.reverse(), ...right];
  }
}
