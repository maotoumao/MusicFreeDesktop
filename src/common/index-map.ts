export interface IIndexMap {
  indexOf: (mediaItem?: IMedia.IMediaBase | null) => number;
  has: (mediaItem?: IMedia.IMediaBase | null) => boolean;
  update: (mediaItems?: IMedia.IMediaBase[]) => void;
}

export function createIndexMap(mediaItems?: IMedia.IMediaBase[]): IIndexMap {
  const indexMap: Map<string, Map<string, number>> = new Map();

  update(mediaItems);

  function update(mediaItems?: IMedia.IMediaBase[]) {
    indexMap.clear();
    if (!mediaItems) {
      return;
    }
    mediaItems?.forEach((mediaItem, index) => {
      if (!mediaItem) {
        return;
      }
      const { platform, id } = mediaItem;
      let idMap = indexMap.get(platform);
      if (!idMap) {
        idMap = new Map();
        indexMap.set(platform, idMap);
      }
      idMap.set(id, index);
    });
  }

  function indexOf(mediaItem?: IMedia.IMediaBase | null) {
    if (!mediaItem) {
      return -1;
    }
    return indexMap.get(mediaItem?.platform)?.get(mediaItem?.id) ?? -1;
  }

  function has(mediaItem?: IMedia.IMediaBase | null) {
    if (!mediaItem) {
      return false;
    }
    return indexMap.get(mediaItem?.platform)?.has(mediaItem?.id) ?? false;
  }

  return {
    update,
    indexOf,
    has
  };
}
