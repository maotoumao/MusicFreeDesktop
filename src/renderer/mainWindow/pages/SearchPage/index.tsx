/**
 * SearchPage — 搜索结果页
 *
 * URL 格式: /search/:query（query 经 encodeURIComponent 编码）
 *
 * 布局：
 *   标题  "xxx的搜索结果"（xxx 以品牌色显示）
 *   TabBar  音乐 | 专辑 | 作者 | 歌单
 *   Chips   当前 type 可用的插件列表
 *   Body    根据 type 渲染对应 ResultComponent
 *
 * 状态全部由 jotai store 管理，方便未来前进/后退恢复。
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useAtomValue, useSetAtom } from 'jotai/react';
import { useSortedSearchablePlugins } from '@infra/pluginManager/renderer/hooks';
import { PluginFeatureUnavailable } from '../../components/business/PluginFeatureUnavailable';
import { TabBar } from '../../components/ui/TabBar';
import { Chip } from '../../components/ui/Chip';
import { MusicResult } from './components/MusicResult';
import { AlbumResult } from './components/AlbumResult';
import { ArtistResult } from './components/ArtistResult';
import { SheetResult } from './components/SheetResult';
import {
    SEARCH_MEDIA_TYPES,
    SEARCH_TAB_LABEL_KEYS,
    type SearchMediaType,
    searchQueryAtom,
    searchResultsAtom,
    activeMediaTypeAtom,
    activePluginPerTypeAtom,
    resetSearchResults,
    store,
} from './store';
import { useSearch } from './useSearch';
import './index.scss';

// ── 组件映射 ──

const RESULT_COMPONENTS: Record<SearchMediaType, React.ComponentType<{ pluginHash: string }>> = {
    music: MusicResult,
    album: AlbumResult,
    artist: ArtistResult,
    sheet: SheetResult,
};

// ── SearchPage ──

export default function SearchPage() {
    const { t } = useTranslation();
    const { query } = useParams<{ query: string }>();
    // react-router 已对 URL 参数自动解码，无需再调用 decodeURIComponent

    const activeType = useAtomValue(activeMediaTypeAtom);
    const pluginPerType = useAtomValue(activePluginPerTypeAtom);
    const setActiveType = useSetAtom(activeMediaTypeAtom);
    const setPluginPerType = useSetAtom(activePluginPerTypeAtom);

    const { search } = useSearch();
    const prevQueryRef = useRef('');

    // ── query 变化 → 重置状态 & 触发首次搜索 ──
    useEffect(() => {
        if (!query || query === prevQueryRef.current) return;
        prevQueryRef.current = query;

        // 重置结果
        resetSearchResults();
        store.set(searchQueryAtom, query);

        // 重置 activeType 到 music — 使用 React setter 确保同一渲染周期可见
        setActiveType('music');
        // 不重置 pluginPerType — 保留用户之前选择的插件偏好
    }, [query, setActiveType]);

    // ── 当前 type 下可用的插件列表 ──
    const availablePlugins = useSortedSearchablePlugins(activeType);

    // ── 当前激活的插件 hash ──
    const activePluginHash = useMemo(() => {
        const stored = pluginPerType[activeType];
        // 如果之前有选择且仍然可用 → 继续使用
        if (stored && availablePlugins.some((p) => p.hash === stored)) {
            return stored;
        }
        // 否则 fallback 到第一个
        return availablePlugins[0]?.hash ?? '';
    }, [pluginPerType, activeType, availablePlugins]);

    // ── 自动触发搜索（当 query/type/plugin 变化时） ──
    // 有意不依赖 results：通过 store.get 读取最新快照避免无限循环。
    useEffect(() => {
        if (!query || !activePluginHash) return;

        // 避免重复发起：用 store.get 取最新快照（不依赖渲染周期的 results）
        const currentResults = store.get(searchResultsAtom);
        const existing = currentResults[activeType]?.[activePluginHash];
        if (existing && existing.query === query && existing.data.length > 0) {
            // 已有数据，不重复搜索
            return;
        }
        if (existing && existing.status !== undefined && existing.query === query) {
            // 已在请求中或已有状态
            return;
        }

        search(query, activeType, activePluginHash);
    }, [query, activeType, activePluginHash, search]);

    // ── 切换 Tab ──
    const handleTabChange = useCallback(
        (key: string) => {
            setActiveType(key as SearchMediaType);
        },
        [setActiveType],
    );

    // ── 切换插件 ──
    const handlePluginChange = useCallback(
        (hash: string) => {
            setPluginPerType((prev) => ({
                ...prev,
                [activeType]: hash,
            }));
        },
        [activeType, setPluginPerType],
    );

    // ── 渲染 ──
    const ResultComponent = RESULT_COMPONENTS[activeType];

    const tabItems = useMemo(
        () =>
            SEARCH_MEDIA_TYPES.map((key) => ({
                key,
                label: t(SEARCH_TAB_LABEL_KEYS[key]),
            })),
        [t],
    );

    return (
        <div className="p-search">
            {/* 标题 */}
            <div className="p-search__header">
                <h2 className="p-search__title">
                    <span className="p-search__title-keyword">「{query}」</span>
                    {t('search.result_title')}
                </h2>

                <div className="p-search__filters">
                    {/* Tab Bar */}
                    <TabBar items={tabItems} activeKey={activeType} onChange={handleTabChange} />

                    {/* Plugin Chips */}
                    <div className="p-search__plugins">
                        {availablePlugins.map((plugin) => (
                            <Chip
                                key={plugin.hash}
                                label={plugin.platform}
                                active={plugin.hash === activePluginHash}
                                onClick={() => handlePluginChange(plugin.hash)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* 结果区 */}
            <div className="p-search__result-body">
                {activePluginHash ? (
                    <ResultComponent pluginHash={activePluginHash} />
                ) : (
                    <PluginFeatureUnavailable featureName={t('common.search')} />
                )}
            </div>
        </div>
    );
}
