import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { ScrollArea } from '@renderer/mainWindow/components/ui/ScrollArea';
import TabBar from '@renderer/mainWindow/components/ui/TabBar';
import { Artwork } from '@renderer/mainWindow/components/ui/Artwork';
import { StatusPlaceholder } from '@renderer/mainWindow/components/ui/StatusPlaceholder';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { useCurrentMusic } from '@renderer/mainWindow/core/trackPlayer/hooks';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import pluginManager from '@infra/pluginManager/renderer';
import mediaMeta from '@infra/mediaMeta/renderer';
import { RequestStatus } from '@common/constant';
import './index.scss';

interface SearchLyricModalProps {
    close: () => void;
}

/** 单个插件的搜索结果 */
interface PluginSearchResult {
    loading: boolean;
    data: ILyric.ILyricItem[];
    error?: boolean;
}

/**
 * SearchLyricModal — 搜索歌词业务弹窗
 *
 * 通过 showModal('SearchLyricModal') 命令式打开。
 * 搜索所有支持 lyric 搜索类型的插件，点击结果关联歌词并刷新。
 */
export default function SearchLyricModal({ close }: SearchLyricModalProps) {
    const { t } = useTranslation();
    const currentMusic = useCurrentMusic();

    // 搜索关键词，默认预填当前歌曲 title + artist
    const defaultQuery = currentMusic
        ? `${currentMusic.title ?? ''}${currentMusic.artist ? ` ${currentMusic.artist}` : ''}`
        : '';
    const [query, setQuery] = useState(defaultQuery);

    // 插件列表
    const plugins = useMemo(() => pluginManager.getSearchablePlugins('lyric'), []);

    // 当前选中的插件 Tab
    const [activePluginKey, setActivePluginKey] = useState(plugins[0]?.hash ?? '');

    // 每个插件的搜索结果
    const [results, setResults] = useState<Record<string, PluginSearchResult>>({});

    // 关联中状态
    const [linking, setLinking] = useState(false);

    // 防止过时响应覆盖新搜索
    const searchIdRef = useRef(0);

    const tabItems = useMemo(
        () => plugins.map((p) => ({ key: p.hash, label: p.platform })),
        [plugins],
    );

    /** 执行搜索 */
    const doSearch = useCallback(
        (searchQuery: string) => {
            if (!searchQuery.trim() || plugins.length === 0) return;

            const searchId = ++searchIdRef.current;

            // 所有插件置为 loading
            const initialResults: Record<string, PluginSearchResult> = {};
            for (const plugin of plugins) {
                initialResults[plugin.hash] = { loading: true, data: [] };
            }
            setResults(initialResults);

            // 并行搜索所有插件
            for (const plugin of plugins) {
                pluginManager
                    .callPluginMethod({
                        hash: plugin.hash,
                        method: 'search',
                        args: [searchQuery.trim(), 1, 'lyric'],
                    })
                    .then((result) => {
                        if (searchIdRef.current !== searchId) return;
                        setResults((prev) => ({
                            ...prev,
                            [plugin.hash]: {
                                loading: false,
                                data: (result?.data as ILyric.ILyricItem[]) ?? [],
                            },
                        }));
                    })
                    .catch(() => {
                        if (searchIdRef.current !== searchId) return;
                        setResults((prev) => ({
                            ...prev,
                            [plugin.hash]: { loading: false, data: [], error: true },
                        }));
                    });
            }
        },
        [plugins],
    );

    // 打开时自动搜索
    const initialSearchDone = useRef(false);
    useEffect(() => {
        if (!initialSearchDone.current && defaultQuery) {
            initialSearchDone.current = true;
            doSearch(defaultQuery);
        }
    }, [defaultQuery, doSearch]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                doSearch(query);
            }
        },
        [doSearch, query],
    );

    /** 点击搜索结果，关联歌词 */
    const handleSelectLyric = useCallback(
        async (lyricItem: ILyric.ILyricItem) => {
            if (!currentMusic || linking) return;

            setLinking(true);
            try {
                // 调用插件 getLyric 获取歌词文本
                const lyricSource = await pluginManager.callPluginMethod({
                    platform: lyricItem.platform,
                    method: 'getLyric',
                    args: [lyricItem],
                });

                if (!lyricSource?.rawLrc && !lyricSource?.translation) {
                    showToast(t('lyric.no_content'), { type: 'warn' });
                    return;
                }

                const rawLrc = lyricSource.rawLrc ?? lyricSource.translation;
                const translation = lyricSource.rawLrc ? lyricSource.translation : undefined;

                // 写入 mediaMeta
                await mediaMeta.setMeta(currentMusic.platform, String(currentMusic.id), {
                    associatedLyric: {
                        musicItem: lyricItem,
                        rawLrc,
                        translation,
                    },
                });

                // 刷新当前歌词
                await trackPlayer.refreshLyric();

                showToast(t('lyric.link_success'));
                close();
            } catch {
                showToast(t('lyric.link_failed'), { type: 'warn' });
            } finally {
                setLinking(false);
            }
        },
        [currentMusic, linking, close],
    );

    const activeResult = results[activePluginKey];

    // 将插件搜索状态映射为 RequestStatus
    const resultStatus = !activeResult
        ? RequestStatus.Idle
        : activeResult.loading
          ? RequestStatus.Pending
          : activeResult.error
            ? RequestStatus.Error
            : RequestStatus.Done;

    return (
        <Modal open onClose={close} title={t('lyric.search')} size="lg">
            <div className="b-search-lyric-modal">
                {/* 搜索栏 */}
                <div className="b-search-lyric-modal__search-bar">
                    <Input
                        prefix={<Search size={16} />}
                        placeholder={t('lyric.search_placeholder')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        allowClear
                        onClear={() => setQuery('')}
                        autoFocus
                    />
                </div>

                {/* 插件 Tab */}
                {plugins.length > 0 && (
                    <TabBar
                        items={tabItems}
                        activeKey={activePluginKey}
                        onChange={setActivePluginKey}
                        className="b-search-lyric-modal__tabs"
                    />
                )}

                {/* 搜索结果 */}
                <ScrollArea className="b-search-lyric-modal__results">
                    {plugins.length === 0 ? (
                        <StatusPlaceholder
                            status={RequestStatus.Done}
                            isEmpty
                            emptyTitle={t('lyric.no_lyric_plugin')}
                        />
                    ) : (
                        <>
                            <StatusPlaceholder
                                status={resultStatus}
                                isEmpty={activeResult?.data.length === 0}
                                emptyTitle={t('lyric.no_result')}
                                errorTitle={t('lyric.search_failed')}
                                onRetry={() => doSearch(query)}
                            />
                            {resultStatus === RequestStatus.Done &&
                                (activeResult?.data ?? []).map((item, index) => (
                                    <button
                                        key={`${item.platform}-${item.id}-${index}`}
                                        type="button"
                                        className="b-search-lyric-modal__item"
                                        disabled={linking}
                                        onClick={() => handleSelectLyric(item)}
                                    >
                                        <Artwork src={item.artwork} size="sm" rounded="sm" />
                                        <div className="b-search-lyric-modal__item-info">
                                            <div className="b-search-lyric-modal__item-title">
                                                {item.title}
                                            </div>
                                            <div className="b-search-lyric-modal__item-artist">
                                                {item.artist}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                        </>
                    )}
                </ScrollArea>
            </div>
        </Modal>
    );
}
