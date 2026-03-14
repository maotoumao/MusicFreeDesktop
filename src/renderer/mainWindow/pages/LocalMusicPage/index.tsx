import { useState, useMemo, useCallback, useDeferredValue, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai/react';
import { FolderSearch, Search, RefreshCw } from 'lucide-react';
import { RequestStatus } from '@common/constant';
import { TabBar, type TabItem } from '../../components/ui/TabBar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SongTable } from '../../components/business/SongTable';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { showModal } from '../../components/ui/Modal/modalManager';
import { useStatusColumn, useRowContextMenu } from './shared';
import {
    filteredLocalMusicAtom,
    localMusicLoadingAtom,
    totalCountAtom,
    artistListAtom,
    albumListAtom,
    scanningAtom,
    ensureLocalMusicStore,
} from './store';
import { ArtistsTab } from './components/ArtistsTab';
import { AlbumsTab } from './components/AlbumsTab';
import { FoldersTab } from './components/FoldersTab';
import './index.scss';

// ─── Tab 定义 ───

type LocalMusicTab = 'songs' | 'artists' | 'albums' | 'folders';

const TAB_KEYS: LocalMusicTab[] = ['songs', 'artists', 'albums', 'folders'];

/**
 * LocalMusicPage — 本地音乐页面
 *
 * 路由: /local-music
 *
 * 功能：
 *   - 页头：标题 + "扫描文件夹" 按钮
 *   - TabBar：单曲 / 歌手 / 专辑 / 文件夹
 *   - 单曲 Tab：SongToolbar + SongTable
 *   - 歌手 Tab：master-detail 布局
 *   - 专辑 Tab：master-detail 布局
 *   - 文件夹 Tab：树形展开结构
 *   - 扫描文件夹 Modal
 *
 * 设计稿还原（像素级）：
 *   页面: pt --space-4
 *   页头: title-size bold, flex justify-between, mb --space-5
 *   TabBar: mb --space-4
 */
export default function LocalMusicPage() {
    const { t } = useTranslation();

    // ── 初始化 store ──
    useEffect(() => {
        ensureLocalMusicStore();
    }, []);

    // ── Tab 状态 ──
    const [activeTab, setActiveTab] = useState<LocalMusicTab>('songs');

    // ── 搜索 ──
    const [searchValue, setSearchValue] = useState('');
    const deferredSearch = useDeferredValue(searchValue);

    // ── 从 store 读取数据（同步） ──
    const allSongs = useAtomValue(filteredLocalMusicAtom);
    const loading = useAtomValue(localMusicLoadingAtom);
    const totalCount = useAtomValue(totalCountAtom);
    const artistList = useAtomValue(artistListAtom);
    const albumList = useAtomValue(albumListAtom);
    const scanning = useAtomValue(scanningAtom);

    // ── Tab 项（带计数） ──
    const tabItems = useMemo<TabItem[]>(() => {
        const tabLabels: Record<LocalMusicTab, string> = {
            songs: t('local_music.tab_songs'),
            artists: t('local_music.tab_artists'),
            albums: t('local_music.tab_albums'),
            folders: t('local_music.tab_folders'),
        };
        return TAB_KEYS.map((key) => {
            let label = tabLabels[key];
            if (key === 'songs' && totalCount > 0) {
                label += ` (${totalCount})`;
            } else if (key === 'artists' && artistList.length > 0) {
                label += ` (${artistList.length})`;
            } else if (key === 'albums' && albumList.length > 0) {
                label += ` (${albumList.length})`;
            }
            return { key, label };
        });
    }, [t, totalCount, artistList.length, albumList.length]);

    // ── 搜索过滤（仅 songs Tab） ──
    const filteredSongs = useMemo(() => {
        const keyword = deferredSearch.trim().toLowerCase();
        if (!keyword) return allSongs;
        return allSongs.filter(
            (item) =>
                item.title.toLowerCase().includes(keyword) ||
                (item.artist ?? '').toLowerCase().includes(keyword) ||
                (item.album ?? '').toLowerCase().includes(keyword),
        );
    }, [allSongs, deferredSearch]);

    // ── 操作回调 ──
    const handleRowContextMenu = useRowContextMenu();

    const handleScanFolder = useCallback(() => {
        showModal('ScanFolderModal');
    }, []);

    // ── 状态列渲染 ──
    const statusColumn = useStatusColumn();

    const isEmpty = !loading && totalCount === 0;

    return (
        <div className="p-local-music">
            {/* ── 页头 ── */}
            <div className="p-local-music__header">
                <div className="p-local-music__title-row">
                    <h2 className="p-local-music__title">{t('local_music.title')}</h2>
                    {scanning && <RefreshCw size={20} className="p-local-music__scan-indicator" />}
                </div>
                <Button
                    variant="secondary"
                    size="md"
                    icon={<FolderSearch size={16} />}
                    onClick={handleScanFolder}
                >
                    {t('local_music.scan_folder')}
                </Button>
            </div>

            {/* ── TabBar + 搜索框 ── */}
            <div className="p-local-music__tab-row">
                <TabBar
                    items={tabItems}
                    activeKey={activeTab}
                    onChange={(k) => setActiveTab(k as LocalMusicTab)}
                />
                <Input
                    className="p-local-music__search"
                    prefix={<Search size={14} />}
                    placeholder={t('local_music.search_placeholder')}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    allowClear
                    onClear={() => setSearchValue('')}
                />
            </div>

            {/* ── Tab 内容 ── */}
            <div className="p-local-music__body">
                {activeTab === 'songs' &&
                    (isEmpty ? (
                        <StatusPlaceholder
                            status={loading ? RequestStatus.Pending : RequestStatus.Done}
                            isEmpty={isEmpty}
                            emptyTitle={t('local_music.empty_title')}
                            emptyDescription={t('local_music.empty_desc')}
                        />
                    ) : (
                        <SongTable
                            data={filteredSongs}
                            requestStatus={RequestStatus.Done}
                            onRowContextMenu={handleRowContextMenu}
                            statusColumn={statusColumn}
                            hideColumns={['platform']}
                        />
                    ))}

                {activeTab === 'artists' && (
                    <ArtistsTab isEmpty={isEmpty} searchKeyword={deferredSearch} />
                )}

                {activeTab === 'albums' && (
                    <AlbumsTab isEmpty={isEmpty} searchKeyword={deferredSearch} />
                )}

                {activeTab === 'folders' && (
                    <FoldersTab isEmpty={isEmpty} searchKeyword={deferredSearch} />
                )}
            </div>
        </div>
    );
}
