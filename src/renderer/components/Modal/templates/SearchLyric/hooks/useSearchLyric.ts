import { RequestStateCode } from "@/common/constant";
import { useCallback, useRef, useState } from "react";
import searchResultStore from "./searchResultStore";
import { produce } from "immer";
import delegatePluginsStore from "@/renderer/core/plugin-delegate/internal/store";
import { callPluginDelegateMethod, getPluginByHash, getSearchablePlugins } from "@/renderer/core/plugin-delegate";
import { useTranslation } from "react-i18next";


export default function (){
    // 当前正在搜索
    const currentQueryRef = useRef<string>("");
    const {t} = useTranslation();

    /**
     * query: 搜索词
     * queryPage: 搜索页码
     * pluginHash: 搜索条件
     */
    const search = useCallback(async function (
        query?: string,
        queryPage?: number,
        pluginHash?: string,
    ) {
        /** 如果没有指定插件，就用所有插件搜索 */
        console.log("SEARCH LRC", query, queryPage);
        let plugins: IPlugin.IPluginDelegate[] = [];
        if (pluginHash) {
           callPluginDelegateMethod
            const tgtPlugin = getPluginByHash(pluginHash);
            if(tgtPlugin) {
                plugins = [tgtPlugin];
            }
        } else {
            plugins = getSearchablePlugins("lyric");
        }
        if (plugins.length === 0) {
            searchResultStore.setValue(
                produce(draft => {
                    draft.data = {};
                }),
            );
            return;
        }
        console.log(plugins);
        // 使用选中插件搜素
        plugins.forEach(async plugin => {
            const _platform = plugin.platform;
            const _hash = plugin.hash;
            if (!_platform || !_hash) {
                // 插件无效，此时直接进入结果页
                searchResultStore.setValue(
                    produce(draft => {
                        draft.data = {};
                    }),
                );
                return;
            }

            // 上一份搜索结果
            const prevPluginResult =
                searchResultStore.getValue().data[plugin.hash];
            /** 上一份搜索还没返回/已经结束 */
            if (
                (prevPluginResult?.state & RequestStateCode.PENDING_FIRST_PAGE ||
                    prevPluginResult?.state === RequestStateCode.FINISHED) &&
                undefined === query
            ) {
                return;
            }

            // 是否是一次新的搜索
            const newSearch =
                query ||
                prevPluginResult?.page === undefined ||
                queryPage === 1;

            // 本次搜索关键词
            currentQueryRef.current = query =
                query ?? searchResultStore.getValue().query ?? "";

            /** 搜索的页码 */
            const page =
                queryPage ?? newSearch ? 1 : (prevPluginResult?.page ?? 0) + 1;
            try {
                searchResultStore.setValue(
                    produce(draft => {
                        const prevMediaResult = draft.data;
                        prevMediaResult[_hash] = {
                            state: newSearch
                                ? RequestStateCode.PENDING_FIRST_PAGE
                                : RequestStateCode.PENDING_REST_PAGE,
                            // @ts-ignore
                            data: newSearch
                                ? []
                                : prevMediaResult[_hash]?.data ?? [],
                            page,
                        };
                    }),
                );
                const result = await callPluginDelegateMethod(plugin, "search", query, page, "lyric");
                console.log(result);
                /** 如果搜索结果不是本次结果 */
                if (currentQueryRef.current !== query) {
                    return;
                }
                /** 切换到结果页 */
                if (!result) {
                    throw new Error(t("modal.serach_lyric_result_empty"));
                }
                searchResultStore.setValue(
                    produce(draft => {
                        const prevMediaResult = draft.data;

                        const prevPluginResult: any = prevMediaResult[
                            _hash
                        ] ?? {
                            data: [],
                        };
                        const currResult = result.data ?? [];

                        prevMediaResult[_hash] = {
                            state:
                                result?.isEnd === false && result?.data?.length
                                    ? RequestStateCode.PARTLY_DONE
                                    : RequestStateCode.FINISHED,
                            page,
                            data: newSearch
                                ? currResult
                                : (prevPluginResult.data ?? []).concat(
                                      currResult,
                                  ),
                        };
                        return draft;
                    }),
                );
            } catch (e: any) {
                /** 如果搜索结果不是本次结果 */
                if (currentQueryRef.current !== query) {
                    return;
                }
                searchResultStore.setValue(
                    produce(draft => {
                        const prevMediaResult = draft.data;
                        const prevPluginResult = prevMediaResult[_hash] ?? {
                            state: RequestStateCode.PARTLY_DONE,
                            data: [] as ILyric.ILyricItem[],
                        };

                        prevPluginResult.state = RequestStateCode.PARTLY_DONE;
                        return draft;
                    }),
                );
            }
        });
    },
    []);

    return search;
}