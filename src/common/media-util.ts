import { produce } from "immer";
import { internalSerializeKey, localPluginName } from "./constant";

export function isSameMedia(a?: IMedia.IMediaBase | null, b?: IMedia.IMediaBase | null) {
    if(a && b) {
        return a.id === b.id && a.platform === b.platform;
    }
    return false;
}

export function resetMediaItem<T extends IMedia.IMediaBase>(
    mediaItem: T,
    platform?: string,
    newObj?: boolean,
): T {
    // 本地音乐不做处理
    if (
        mediaItem.platform === localPluginName ||
        platform === localPluginName
    ) {
        return newObj ? {...mediaItem} : mediaItem;
    }
    if (!newObj) {
        mediaItem.platform = platform ?? mediaItem.platform;
        mediaItem[internalSerializeKey] = undefined;
        return mediaItem;
    } else {
        return produce(mediaItem, _ => {
            _.platform = platform ?? mediaItem.platform;
            _[internalSerializeKey] = undefined;
        });
    }
}

export function getMediaPrimaryKey(mediaItem: IMedia.IMediaBase) {
    return `${mediaItem.platform}@${mediaItem.id}`
}