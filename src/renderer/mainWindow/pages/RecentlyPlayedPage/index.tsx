import { useState, useMemo, useCallback, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Trash2 } from 'lucide-react';
import { RequestStatus } from '@common/constant';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import {
    useRecentlyPlayedList,
    clearRecentlyPlayed,
    RECENTLY_PLAYED_ID,
} from '@renderer/mainWindow/core/recentlyPlayed';
import { SongTable, type RowInteractionDetail } from '../../components/business/SongTable';
import { FavoriteButton } from '../../components/business/FavoriteButton';
import { DownloadButton } from '../../components/business/DownloadButton';
import { SongToolbar } from '../../components/ui/SongToolbar';
import { ListFooter } from '../../components/ui/ListFooter';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { Button } from '../../components/ui/Button';
import { showModal } from '../../components/ui/Modal/modalManager';
import { showContextMenu } from '../../components/ui/ContextMenu/contextMenuManager';
import './index.scss';

/**
 * RecentlyPlayedPage — 最近播放页面
 *
 * 设计稿还原：
 *   页头: h2 "最近播放" + "共 N 首" 副标题
 *   工具栏: 播放全部 + 清空记录按钮 + 搜索框
 *   列表: SongTable（双击播放，右键菜单）
 *   空态: StatusPlaceholder (Clock, "暂无播放记录")
 *   清空: Modal 二次确认（sm, danger）
 */
export default function RecentlyPlayedPage() {
    const { t } = useTranslation();
    const recentList = useRecentlyPlayedList();

    // ── 页内搜索 ──
    const [searchValue, setSearchValue] = useState('');

    const filteredList = useMemo(() => {
        const keyword = searchValue.trim().toLowerCase();
        if (!keyword) return recentList;
        return recentList.filter(
            (item) =>
                item.title?.toLowerCase().includes(keyword) ||
                item.artist?.toLowerCase().includes(keyword) ||
                item.album?.toLowerCase().includes(keyword),
        );
    }, [recentList, searchValue]);

    // ── 清空确认弹窗 ──
    const handleClear = useCallback(() => {
        showModal('ConfirmModal', {
            title: t('history.clear_confirm_title'),
            message: t('history.clear_confirm_desc', { count: recentList.length }),
            confirmText: t('history.clear_confirm_btn'),
            confirmDanger: true,
            onConfirm: () => clearRecentlyPlayed(),
        });
    }, [t, recentList.length]);

    // ── 播放 ──
    const handlePlayAll = useCallback(() => {
        if (filteredList.length > 0) {
            trackPlayer.playMusicWithReplaceQueue(filteredList);
        }
    }, [filteredList]);

    // ── 右键菜单 ──
    const handleRowContextMenu = useCallback(
        ({ selectedItems }: RowInteractionDetail, e: MouseEvent) => {
            showContextMenu(
                'MusicItemMenu',
                { x: e.clientX, y: e.clientY },
                {
                    musicItems: selectedItems as IMusic.IMusicItem[],
                    sheetId: RECENTLY_PLAYED_ID,
                },
            );
        },
        [],
    );

    // ── 状态列：当前播放高亮已由 SongTable 内部处理 ──

    const isEmpty = recentList.length === 0;

    return (
        <div className="p-recently-played">
            {/* ── 页头 ── */}
            <h2 className="p-recently-played__title">{t('history.title')}</h2>
            {!isEmpty && (
                <p className="p-recently-played__meta">
                    {t('history.total_count', { count: recentList.length })}
                </p>
            )}

            {/* ── 列表区 ── */}
            {!isEmpty ? (
                <>
                    <div className="p-recently-played__toolbar">
                        <SongToolbar
                            searchPlaceholder={t('history.search_placeholder')}
                            searchValue={searchValue}
                            onSearchChange={setSearchValue}
                            onPlayAll={handlePlayAll}
                        >
                            <Button
                                variant="secondary"
                                size="md"
                                icon={<Trash2 size={16} />}
                                onClick={handleClear}
                            >
                                {t('history.clear')}
                            </Button>
                        </SongToolbar>
                    </div>

                    <SongTable
                        data={filteredList}
                        statusColumn={(item) => (
                            <>
                                <FavoriteButton musicItem={item} size="sm" />
                                <DownloadButton musicItem={item} size="sm" />
                            </>
                        )}
                        onRowContextMenu={handleRowContextMenu}
                    />
                    <ListFooter status={RequestStatus.Done} />
                </>
            ) : (
                <StatusPlaceholder
                    status={RequestStatus.Done}
                    isEmpty
                    emptyIcon={Clock}
                    emptyTitle={t('history.empty_title')}
                    emptyDescription={t('history.empty_desc')}
                />
            )}
        </div>
    );
}
