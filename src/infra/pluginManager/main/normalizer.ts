/**
 * pluginManager — 方法标准化器
 *
 * 为每个插件方法定义 beforeCall（输入清洗）、afterCall（输出标准化）、defaultResult（默认返回值）。
 * 替代多处 switch/if 分支，实现统一的调用前后处理。
 */

import { cleanMediaInput, resetMediaItem, resetMediaItems } from '../common/mediaUtil';

/**
 * 方法标准化器定义。
 * - beforeCall: 在调用插件方法前对参数进行清洗/转换。接收原始 args 数组，返回新 args。
 * - afterCall: 在调用插件方法后对返回值进行标准化。接收原始返回值、平台名及原始调用参数。
 * - defaultResult: 当插件未实现该方法时的默认返回值工厂。接收原始调用参数。
 */
interface IMethodNormalizer {
    beforeCall?: (args: any[]) => any[];
    afterCall?: (result: any, platform: string, args: any[]) => any;
    defaultResult?: (args: any[]) => any;
}

/**
 * 各插件方法的标准化器注册表。
 * 未注册的方法将直接透传。
 */
export const methodNormalizers: Partial<
    Record<keyof IPlugin.IPluginInstanceMethods, IMethodNormalizer>
> = {
    // ─── search ───
    search: {
        afterCall(result, platform) {
            if (!result) return { isEnd: true, data: [] };
            return {
                isEnd: result.isEnd ?? true,
                data: resetMediaItems(result.data, platform),
            };
        },
        defaultResult: () => ({ isEnd: true, data: [] }),
    },

    // ─── getMediaSource ───
    getMediaSource: {
        beforeCall(args) {
            // args: [musicItem, quality]
            return [cleanMediaInput(args[0]), args[1]];
        },
        afterCall(result, _platform, args) {
            // 插件返回但无 url 时返回 null，
            // 表示此音质不可用，adapter 层据此跳过重试直接尝试下一音质。
            const url = result?.url ?? (args[0] as any)?.qualities?.[args[1]]?.url;
            if (!url) {
                return null;
            }
            return {
                url,
                headers: result?.headers,
                userAgent: result?.headers?.['user-agent'],
                quality: result?.quality ?? args[1],
            };
        },
        defaultResult(args) {
            // 插件未实现时，返回 musicItem 自身的 qualities URL 或 url
            const musicItem = args[0];
            const quality = args[1] as IMusic.IQualityKey;
            const url =
                (musicItem?.qualities as Record<string, { url?: string }> | undefined)?.[quality]
                    ?.url ?? musicItem?.url;

            if (!url) return null;
            return { url, quality };
        },
    },

    // ─── getMusicInfo ───
    getMusicInfo: {
        beforeCall(args) {
            return [cleanMediaInput(args[0])];
        },
        afterCall(result, platform) {
            return resetMediaItem(result, platform);
        },
        defaultResult: () => null,
    },

    // ─── getLyric ───
    getLyric: {
        beforeCall(args) {
            return [cleanMediaInput(args[0])];
        },
        afterCall(result) {
            if (!result) return null;

            // 翻译提升逻辑统一在 getLyricAdapter 中处理，此处只做字段透传
            return {
                lrc: result.lrc,
                rawLrc: result.rawLrc,
                translation: result.translation,
            };
        },
        defaultResult: () => null,
    },

    // ─── getAlbumInfo ───
    getAlbumInfo: {
        beforeCall(args) {
            // args: [albumItem, page]
            return [cleanMediaInput(args[0]), args[1]];
        },
        afterCall(result, platform, args) {
            if (!result) throw new Error();

            const albumItem = args[0] as IAlbum.IAlbumItem;
            const page = args[1] as number;

            // resetMediaItem + 设置 album 字段
            result?.musicList?.forEach((_: any) => {
                resetMediaItem(_, platform);
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
        },
        defaultResult(args) {
            // 插件未实现时，返回 albumItem 自身的 musicList
            const albumItem = args[0] as IAlbum.IAlbumItem;
            return {
                isEnd: true,
                albumItem,
                musicList: (albumItem?.musicList ?? []).map((it: any) =>
                    resetMediaItem(it, albumItem.platform),
                ),
            };
        },
    },

    // ─── getMusicSheetInfo ───
    getMusicSheetInfo: {
        beforeCall(args) {
            return [cleanMediaInput(args[0]), args[1]];
        },
        afterCall(result, platform, args) {
            if (!result) throw new Error();

            const sheetItem = args[0] as IMusic.IMusicSheetItem;
            const page = args[1] as number;

            result?.musicList?.forEach((_: any) => {
                resetMediaItem(_, platform);
            });

            if (page <= 1) {
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
        },
        defaultResult(args) {
            const sheetItem = args[0] as IMusic.IMusicSheetItem;
            return {
                sheetItem,
                musicList: sheetItem?.musicList ?? [],
                isEnd: true,
            };
        },
    },

    // ─── getArtistWorks ───
    getArtistWorks: {
        beforeCall(args) {
            // args: [artistItem, page, type]
            return [cleanMediaInput(args[0]), args[1], args[2]];
        },
        afterCall(result, platform) {
            if (!result) return { isEnd: true, data: [] };
            return {
                isEnd: result.isEnd ?? true,
                data: resetMediaItems(result.data, platform),
            };
        },
        defaultResult: () => ({ isEnd: true, data: [] }),
    },

    // ─── importMusicSheet ───
    importMusicSheet: {
        afterCall(result, platform) {
            return resetMediaItems(result, platform);
        },
        defaultResult: () => [],
    },

    // ─── importMusicItem ───
    importMusicItem: {
        afterCall(result, platform) {
            return resetMediaItem(result, platform);
        },
        defaultResult: () => null,
    },

    // ─── getTopLists ───
    // 旧版不对 getTopLists 结果做 resetMediaItem，保持一致
    getTopLists: {
        afterCall(result) {
            if (!result || !Array.isArray(result)) return [];
            return result;
        },
        defaultResult: () => [],
    },

    // ─── getTopListDetail ───
    getTopListDetail: {
        afterCall(result, platform) {
            if (!result) return { isEnd: true, musicList: [] };

            if (result.musicList) {
                result.musicList = resetMediaItems(result.musicList, platform);
            }
            if (result.isEnd !== false) {
                result.isEnd = true;
            }
            return result;
        },
        defaultResult: (args) => ({ isEnd: true, topListItem: args[0], musicList: [] }),
    },

    // ─── getRecommendSheetTags ───
    // 旧版不对 getRecommendSheetTags 结果做 resetMediaItem，保持一致
    getRecommendSheetTags: {
        afterCall(result) {
            if (!result) return { data: [] };
            return result;
        },
        defaultResult: () => ({ data: [] }),
    },

    // ─── getRecommendSheetsByTag ───
    getRecommendSheetsByTag: {
        afterCall(result, platform) {
            if (!result) return { isEnd: true, data: [] };
            return {
                isEnd: result.isEnd ?? true,
                data: resetMediaItems(result.data, platform),
            };
        },
        defaultResult: () => ({ isEnd: true, data: [] }),
    },

    // ─── getMusicComments ───
    getMusicComments: {
        beforeCall(args) {
            return [cleanMediaInput(args[0]), args[1]];
        },
        afterCall(result) {
            if (!result) return { isEnd: true, data: [] };
            return result;
        },
        defaultResult: () => ({ isEnd: true, data: [] }),
    },
};
