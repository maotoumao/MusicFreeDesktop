// ============================================================================
// TopBar — 顶部导航栏
// ============================================================================

import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useMatch } from 'react-router';
import { ChevronLeft, ChevronRight, Search, Minus, Square, X } from 'lucide-react';
import systemUtil from '@infra/systemUtil/renderer';
import appConfig from '@infra/appConfig/renderer';
import { searchRoute, RoutePaths } from '../../../routes';
import { Chip } from '../../ui/Chip';
import {
    getSearchHistory,
    addSearchHistory,
    clearSearchHistory,
} from '../../../common/searchHistory';
import './index.scss';

export default function TopBar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchValue, setSearchValue] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

    // ── 路由同步：当导航到搜索页时，同步搜索框文本 ──
    const searchMatch = useMatch(`/${RoutePaths.Search}/:query`);
    useEffect(() => {
        if (searchMatch?.params.query) {
            setSearchValue(searchMatch.params.query);
        }
    }, [searchMatch?.params.query]);

    // ── 打开面板时加载历史 ──
    useEffect(() => {
        if (isPanelOpen) {
            setSearchHistory(getSearchHistory());
        }
    }, [isPanelOpen]);

    // ── 导航状态 ──
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);

    useEffect(() => {
        if (typeof navigation === 'undefined') return;

        const update = () => {
            setCanGoBack(navigation.canGoBack);
            setCanGoForward(navigation.canGoForward);
        };
        update();

        navigation.addEventListener('navigatesuccess', update);
        return () => {
            navigation.removeEventListener('navigatesuccess', update);
        };
    }, []);

    // ── 提交搜索 ──
    const commitSearch = useCallback(
        (value: string) => {
            const trimmed = value.trim();
            if (!trimmed) return;

            // 保存历史
            const updated = addSearchHistory(trimmed);
            setSearchHistory(updated);

            // 关闭面板 & 导航
            setIsPanelOpen(false);
            inputRef.current?.blur();
            navigate(searchRoute(trimmed));
        },
        [navigate],
    );

    const handleSearchKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                commitSearch(searchValue);
            }
            if (e.key === 'Escape') {
                setIsPanelOpen(false);
                inputRef.current?.blur();
            }
        },
        [searchValue, commitSearch],
    );

    // ── 面板开关（blur 延迟避免点击面板时被关掉） ──
    const handleFocus = useCallback(() => {
        clearTimeout(blurTimerRef.current);
        setIsSearchFocused(true);
        setIsPanelOpen(true);
    }, []);

    const handleBlur = useCallback(() => {
        setIsSearchFocused(false);
        blurTimerRef.current = setTimeout(() => {
            setIsPanelOpen(false);
        }, 150);
    }, []);

    // ── 历史条目点击 ──
    const handleHistoryClick = useCallback(
        (item: string) => {
            setSearchValue(item);
            commitSearch(item);
        },
        [commitSearch],
    );

    // ── 清除历史 ──
    const handleClearHistory = useCallback(() => {
        clearSearchHistory();
        setSearchHistory([]);
    }, []);

    const handleMinimize = useCallback(() => {
        systemUtil.minimizeWindow();
    }, []);

    const handleMaximize = useCallback(() => {
        systemUtil.toggleMaximize();
    }, []);

    const handleClose = useCallback(() => {
        if (appConfig.getConfigByKey('normal.closeBehavior') === 'exit_app') {
            systemUtil.exitApp();
        } else {
            systemUtil.minimizeWindow(true);
        }
    }, []);

    return (
        <header className="l-topbar">
            {/* ── 拖拽区域 ── */}
            <div className="l-topbar__drag-region" />

            {/* ── 左侧: 导航按钮 ── */}
            <div className="l-topbar__nav">
                <button
                    className="l-topbar__nav-btn l-topbar__nav-btn--left"
                    type="button"
                    title={t('app.nav_back')}
                    disabled={!canGoBack}
                    onClick={() => navigation.back()}
                >
                    <ChevronLeft size={16} />
                </button>
                <button
                    className="l-topbar__nav-btn l-topbar__nav-btn--right"
                    type="button"
                    title={t('app.nav_forward')}
                    disabled={!canGoForward}
                    onClick={() => navigation.forward()}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* ── 中间: 搜索框 + 下拉面板 ── */}
            <div className={`l-topbar__search${isSearchFocused ? ' is-focused' : ''}`}>
                <Search size={16} className="l-topbar__search-icon" />
                <input
                    ref={inputRef}
                    className="l-topbar__search-input"
                    type="text"
                    placeholder={t('search.placeholder')}
                    aria-label={t('common.search')}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleSearchKeyDown}
                />

                {/* ── 搜索面板 ── */}
                {isPanelOpen && (
                    <div className="l-topbar__search-panel" onMouseDown={(e) => e.preventDefault()}>
                        <div className="l-topbar__search-panel-header">
                            <span className="l-topbar__search-panel-label">
                                {t('search.history')}
                            </span>
                            {searchHistory.length > 0 && (
                                <button
                                    type="button"
                                    className="l-topbar__search-panel-clear"
                                    onClick={handleClearHistory}
                                >
                                    {t('search.clear_history')}
                                </button>
                            )}
                        </div>
                        <div className="l-topbar__search-panel-chips">
                            {searchHistory.length === 0 ? (
                                <span className="l-topbar__search-panel-empty">
                                    {t('search.no_history')}
                                </span>
                            ) : (
                                searchHistory.map((item) => (
                                    <Chip
                                        key={item}
                                        label={item}
                                        onClick={() => handleHistoryClick(item)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── 右侧: 窗口控制按钮 ── */}
            <div className="l-topbar__window-controls">
                <button
                    className="l-topbar__win-btn"
                    type="button"
                    title={t('app.minimize')}
                    onClick={handleMinimize}
                >
                    <Minus size={14} strokeWidth={1.5} />
                </button>
                <button
                    className="l-topbar__win-btn"
                    type="button"
                    title={t('app.maximize')}
                    onClick={handleMaximize}
                >
                    <Square size={10} strokeWidth={1.5} />
                </button>
                <button
                    className="l-topbar__win-btn l-topbar__win-btn--close"
                    type="button"
                    title={t('common.close')}
                    onClick={handleClose}
                >
                    <X size={14} strokeWidth={1.5} />
                </button>
            </div>
        </header>
    );
}
