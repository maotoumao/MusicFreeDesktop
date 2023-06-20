import { isSameMedia, resetMediaItem } from "@/common/media-util";
import type { Plugin } from "./plugin";
import { localFilePathSymbol } from "@/common/constant";
import fs from "fs/promises";
import { delay } from "@/common/time-util";

export default class PluginMethods implements IPlugin.IPluginInstanceMethods {
  private plugin;
  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }
  /** 搜索 */
  async search<T extends IMedia.SupportMediaType>(
    query: string,
    page: number,
    type: T
  ): Promise<IPlugin.ISearchResult<T>> {
    if (!this.plugin.instance.search) {
      return {
        isEnd: true,
        data: [],
      };
    }

    const result = await this.plugin.instance.search(query, page, type);
    console.log(result, this.plugin.instance.search, query, page, type);
    if (Array.isArray(result.data)) {
      result.data.forEach((_) => {
        resetMediaItem(_, this.plugin.name);
      });
      return {
        isEnd: result.isEnd ?? true,
        data: result.data,
      };
    }
    return {
      isEnd: true,
      data: [],
    };
  }

  /** 获取真实源 */
  async getMediaSource(
    musicItem: IMedia.IMediaBase,
    quality: IMusic.IQualityKey = "standard",
    retryCount = 1,
    notUpdateCache = false
  ): Promise<IPlugin.IMediaSourceResult | null> {
    // 1. 本地搜索
    const localFilePath = musicItem[localFilePathSymbol];
    try {
      const fileData = await fs.stat(localFilePath);
      if (fileData.isFile()) {
        return {
          url: localFilePath,
        };
      }
    } catch {
      // TODO 本地文件失效
    }
    // TODO 2. url 缓存策略，先略过

    // 3 插件解析
    if (!this.plugin.instance.getMediaSource) {
      return { url: musicItem?.qualities?.[quality]?.url ?? musicItem.url };
    }
    try {
      const { url, headers } = (await this.plugin.instance.getMediaSource(
        musicItem,
        quality
      )) ?? { url: musicItem?.qualities?.[quality]?.url };
      if (!url) {
        throw new Error("NOT RETRY");
      }
      const result = {
        url,
        headers,
        userAgent: headers?.["user-agent"],
      } as IPlugin.IMediaSourceResult;

    //   if (pluginCacheControl !== CacheControl.NoStore && !notUpdateCache) {
    //     Cache.update(musicItem, [
    //       ["headers", result.headers],
    //       ["userAgent", result.userAgent],
    //       [`qualities.${quality}.url`, url],
    //     ]);
    //   }

      return result;
    } catch (e: any) {
      if (retryCount > 0 && e?.message !== "NOT RETRY") {
        await delay(150);
        return this.getMediaSource(musicItem, quality, --retryCount);
      }
      // devLog('error', '获取真实源失败', e, e?.message);
      return null;
    }
  }

  /** 获取音乐详情 */
  async getMusicInfo(
    musicItem: IMedia.IMediaBase
  ): Promise<Partial<IMusic.IMusicItem> | null> {
    if (!this.plugin.instance.getMusicInfo) {
      return null;
    }
    try {
      return (
        this.plugin.instance.getMusicInfo(
          resetMediaItem(musicItem, undefined, true)
        ) ?? null
      );
    } catch (e: any) {
      // devLog('error', '获取音乐详情失败', e, e?.message);
      return null;
    }
  }

  /** 获取歌词 */
  async getLyric(
    musicItem: IMusic.IMusicItem,
    from?: IMusic.IMusicItem
  ): Promise<ILyric.ILyricSource | null> {
    // // 1.额外存储的meta信息
    // const meta = MediaMeta.get(musicItem);
    // if (meta && meta.associatedLrc) {
    //     // 有关联歌词
    //     if (
    //         isSameMedia(musicItem, from) ||
    //         isSameMedia(meta.associatedLrc, musicItem)
    //     ) {
    //         // 形成环路，断开当前的环
    //         await MediaMeta.update(musicItem, {
    //             associatedLrc: undefined,
    //         });
    //         // 无歌词
    //         return null;
    //     }
    //     // 获取关联歌词
    //     const associatedMeta = MediaMeta.get(meta.associatedLrc) ?? {};
    //     const result = await this.getLyric(
    //         {...meta.associatedLrc, ...associatedMeta},
    //         from ?? musicItem,
    //     );
    //     if (result) {
    //         // 如果有关联歌词，就返回关联歌词，深度优先
    //         return result;
    //     }
    // }
    // const cache = Cache.get(musicItem);
    // let rawLrc = meta?.rawLrc || musicItem.rawLrc || cache?.rawLrc;
    // let lrcUrl = meta?.lrc || musicItem.lrc || cache?.lrc;
    // // 如果存在文本
    // if (rawLrc) {
    //     return {
    //         rawLrc,
    //         lrc: lrcUrl,
    //     };
    // }
    // // 2.本地缓存
    // const localLrc =
    //     meta?.[internalSerializeKey]?.local?.localLrc ||
    //     cache?.[internalSerializeKey]?.local?.localLrc;
    // if (localLrc && (await exists(localLrc))) {
    //     rawLrc = await readFile(localLrc, 'utf8');
    //     return {
    //         rawLrc,
    //         lrc: lrcUrl,
    //     };
    // }
    // // 3.优先使用url
    // if (lrcUrl) {
    //     try {
    //         // 需要超时时间 axios timeout 但是没生效
    //         rawLrc = (await axios.get(lrcUrl, {timeout: 2000})).data;
    //         return {
    //             rawLrc,
    //             lrc: lrcUrl,
    //         };
    //     } catch {
    //         lrcUrl = undefined;
    //     }
    // }
    // // 4. 如果地址失效
    // if (!lrcUrl) {
    //     // 插件获得url
    //     try {
    //         let lrcSource;
    //         if (from) {
    //             lrcSource = await PluginManager.getByMedia(
    //                 musicItem,
    //             )?.instance?.getLyric?.(
    //                 resetMediaItem(musicItem, undefined, true),
    //             );
    //         } else {
    //             lrcSource = await this.plugin.instance?.getLyric?.(
    //                 resetMediaItem(musicItem, undefined, true),
    //             );
    //         }

    //         rawLrc = lrcSource?.rawLrc;
    //         lrcUrl = lrcSource?.lrc;
    //     } catch (e: any) {
    //         // trace('插件获取歌词失败', e?.message, 'error');
    //         // devLog('error', '插件获取歌词失败', e, e?.message);
    //     }
    // }
    // // 5. 最后一次请求
    // if (rawLrc || lrcUrl) {
    //     const filename = `${pathConst.lrcCachePath}${nanoid()}.lrc`;
    //     if (lrcUrl) {
    //         try {
    //             rawLrc = (await axios.get(lrcUrl, {timeout: 2000})).data;
    //         } catch {}
    //     }
    //     if (rawLrc) {
    //         await writeFile(filename, rawLrc, 'utf8');
    //         // 写入缓存
    //         Cache.update(musicItem, [
    //             [`${internalSerializeKey}.local.localLrc`, filename],
    //         ]);
    //         // 如果有meta
    //         if (meta) {
    //             MediaMeta.update(musicItem, [
    //                 [`${internalSerializeKey}.local.localLrc`, filename],
    //             ]);
    //         }
    //         return {
    //             rawLrc,
    //             lrc: lrcUrl,
    //         };
    //     }
    // }
    // // 6. 如果是本地文件
    // const isDownloaded = LocalMusicSheet.isLocalMusic(musicItem);
    // if (musicItem.platform !== localPluginPlatform && isDownloaded) {
    //     const res = await localFilePlugin.instance!.getLyric!(isDownloaded);
    //     if (res) {
    //         return res;
    //     }
    // }
    // devLog('warn', '无歌词');

    return null;
  }

  /** 获取歌词文本 */
  async getLyricText(
    musicItem: IMusic.IMusicItem
  ): Promise<string | undefined> {
    return (await this.getLyric(musicItem))?.rawLrc;
  }

  /** 获取专辑信息 */
  async getAlbumInfo(
    albumItem: IAlbum.IAlbumItem,
    page = 1
  ): Promise<IPlugin.IAlbumInfoResult | null> {
    if (!this.plugin.instance.getAlbumInfo) {
      return {
        albumItem,
        musicList: albumItem?.musicList ?? [],
        isEnd: true,
      };
    }
    try {
      const result = await this.plugin.instance.getAlbumInfo(
        resetMediaItem(albumItem, undefined, true),
        page
      );
      if (!result) {
        throw new Error();
      }
      result?.musicList?.forEach((_) => {
        resetMediaItem(_, this.plugin.name);
        _.album = albumItem.title;
      });

      if (page <= 1) {
        // 合并信息
        return {
          albumItem: { ...albumItem, ...(result?.albumItem ?? {}) },
          isEnd: result.isEnd === false ? false : true,
          musicList: result.musicList,
        };
      } else {
        return {
          isEnd: result.isEnd === false ? false : true,
          musicList: result.musicList,
        };
      }
    } catch (e: any) {
      // trace('获取专辑信息失败', e?.message);
      // devLog('error', '获取专辑信息失败', e, e?.message);

      return null;
    }
  }

  /** 获取歌单信息 */
  async getMusicSheetInfo(
    sheetItem: IMusic.IMusicSheetItem,
    page = 1
  ): Promise<IPlugin.ISheetInfoResult | null> {
    if (!this.plugin.instance.getAlbumInfo) {
      return {
        sheetItem,
        musicList: sheetItem?.musicList ?? [],
        isEnd: true,
      };
    }
    try {
      const result = await this.plugin.instance?.getMusicSheetInfo?.(
        resetMediaItem(sheetItem, undefined, true),
        page
      );
      if (!result) {
        throw new Error();
      }
      result?.musicList?.forEach((_) => {
        resetMediaItem(_, this.plugin.name);
      });

      if (page <= 1) {
        // 合并信息
        return {
          sheetItem: { ...sheetItem, ...(result?.sheetItem ?? {}) },
          isEnd: result.isEnd === false ? false : true,
          musicList: result.musicList,
        };
      } else {
        return {
          isEnd: result.isEnd === false ? false : true,
          musicList: result.musicList,
        };
      }
    } catch (e: any) {
      // trace('获取歌单信息失败', e, e?.message);
      // devLog('error', '获取歌单信息失败', e, e?.message);

      return null;
    }
  }

  /** 查询作者信息 */
  async getArtistWorks<T extends IArtist.ArtistMediaType>(
    artistItem: IArtist.IArtistItem,
    page: number,
    type: T
  ): Promise<IPlugin.ISearchResult<T>> {
    if (!this.plugin.instance.getArtistWorks) {
      return {
        isEnd: true,
        data: [],
      };
    }
    try {
      const result = await this.plugin.instance.getArtistWorks(
        artistItem,
        page,
        type
      );
      if (!result.data) {
        return {
          isEnd: true,
          data: [],
        };
      }
      result.data?.forEach((_) => resetMediaItem(_, this.plugin.name));
      return {
        isEnd: result.isEnd ?? true,
        data: result.data,
      };
    } catch (e: any) {
      // trace('查询作者信息失败', e?.message);
      // devLog('error', '查询作者信息失败', e, e?.message);
      console.log(e);
      throw e;
    }
  }

  /** 导入歌单 */
  async importMusicSheet(urlLike: string): Promise<IMusic.IMusicItem[]> {
    try {
      const result =
        (await this.plugin.instance?.importMusicSheet?.(urlLike)) ?? [];
      result.forEach((_) => resetMediaItem(_, this.plugin.name));
      return result;
    } catch (e: any) {
      console.log(e);
      // devLog('error', '导入歌单失败', e, e?.message);

      return [];
    }
  }
  /** 导入单曲 */
  async importMusicItem(urlLike: string): Promise<IMusic.IMusicItem | null> {
    try {
      const result = await this.plugin.instance?.importMusicItem?.(urlLike);
      if (!result) {
        throw new Error();
      }
      resetMediaItem(result, this.plugin.name);
      return result;
    } catch (e: any) {
      // devLog('error', '导入单曲失败', e, e?.message);

      return null;
    }
  }
  /** 获取榜单 */
  async getTopLists(): Promise<IMusic.IMusicSheetGroupItem[]> {
    try {
      const result = await this.plugin.instance?.getTopLists?.();
      if (!result) {
        throw new Error();
      }
      return result;
    } catch (e: any) {
      // devLog('error', '获取榜单失败', e, e?.message);
      return [];
    }
  }
  /** 获取榜单详情 */
  async getTopListDetail(
    topListItem: IMusic.IMusicSheetItem
  ): Promise<ICommon.WithMusicList<IMusic.IMusicSheetItem>> {
    try {
      const result = await this.plugin.instance?.getTopListDetail?.(
        topListItem
      );
      if (!result) {
        throw new Error();
      }
      if (result.musicList) {
        result.musicList.forEach((_) => resetMediaItem(_, this.plugin.name));
      }
      return result;
    } catch (e: any) {
      // devLog('error', '获取榜单详情失败', e, e?.message);
      return {
        ...topListItem,
        musicList: [],
      };
    }
  }

  /** 获取推荐歌单的tag */
  async getRecommendSheetTags(): Promise<IPlugin.IGetRecommendSheetTagsResult> {
    try {
      const result = await this.plugin.instance?.getRecommendSheetTags?.();
      if (!result) {
        throw new Error();
      }
      return result;
    } catch (e: any) {
      // devLog('error', '获取推荐歌单失败', e, e?.message);
      return {
        data: [],
      };
    }
  }
  /** 获取某个tag的推荐歌单 */
  async getRecommendSheetsByTag(
    tagItem: IMedia.IUnique,
    page?: number
  ): Promise<ICommon.PaginationResponse<IMusic.IMusicSheetItem>> {
    try {
      const result = await this.plugin.instance?.getRecommendSheetsByTag?.(
        tagItem,
        page ?? 1
      );
      if (!result) {
        throw new Error();
      }
      if (result.isEnd !== false) {
        result.isEnd = true;
      }
      if (!result.data) {
        result.data = [];
      }
      result.data.forEach((item) => resetMediaItem(item, this.plugin.name));

      return result;
    } catch (e: any) {
      // devLog('error', '获取推荐歌单详情失败', e, e?.message);
      return {
        isEnd: true,
        data: [],
      };
    }
  }
}