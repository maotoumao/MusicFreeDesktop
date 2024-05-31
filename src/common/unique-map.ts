export interface IUniqueMap {
  getMap: () => Record<string, Set<string>>;
  has: (mediaItem?: IMedia.IMediaBase | null) => boolean;
  add: (mediaItem?: IMedia.IMediaBase | IMedia.IMediaBase[] | null) => void;
  remove: (mediaItem?: IMedia.IMediaBase | IMedia.IMediaBase[] | null) => void;
}

export function createUniqueMap(mediaItems?: IMedia.IMediaBase[]): IUniqueMap {
  const uniqueMap: Record<string, Set<string>> = {};

  mediaItems?.forEach((item) => {
    add(item);
  });

  function getMap() {
    return uniqueMap;
  }

  function has(mediaItem?: IMedia.IMediaBase | null) {
    if (!mediaItem) {
      return false;
    }

    return uniqueMap[`${mediaItem.platform}`]?.has(`${mediaItem.id}`) || false;
  }

  function add(mediaItem?: IMedia.IMediaBase | IMedia.IMediaBase[] | null) {
    if (!mediaItem) {
      return;
    }
    const _mediaItem = Array.isArray(mediaItem) ? mediaItem : [mediaItem];
    _mediaItem.forEach((item) => {
      if (!uniqueMap[`${item.platform}`]) {
        uniqueMap[`${item.platform}`] = new Set([`${item.id}`]);
      } else {
        uniqueMap[`${item.platform}`].add(`${item.id}`);
      }
    });
  }

  function remove(mediaItem?: IMedia.IMediaBase | IMedia.IMediaBase[] | null) {
    if (!mediaItem) {
      return;
    }
    const _mediaItem = Array.isArray(mediaItem) ? mediaItem : [mediaItem];

    _mediaItem.forEach((item) => {
      if (uniqueMap[`${item.platform}`]) {
        uniqueMap[`${item.platform}`].delete(`${item.id}`);
      }
    });
  }

  return {
    getMap,
    add,
    has,
    remove,
  };
}
