import {
    useState,
    useMemo,
    useDeferredValue,
    useCallback,
    useEffect,
    type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { RequestStatus } from '@common/constant';
import appConfig from '@infra/appConfig/renderer';
import musicSheet, { useCurrentMusicList, useIsLoadingSheet } from '@infra/musicSheet/renderer';
import { DOWNLOADED_SHEET_ID } from '@infra/musicSheet/common/constant';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { SongTable, type RowInteractionDetail } from '../../../../components/business/SongTable';
import { FavoriteButton } from '../../../../components/business/FavoriteButton';
import { DownloadButton } from '../../../../components/business/DownloadButton';
import { SongToolbar } from '../../../../components/ui/SongToolbar';
import { ListFooter } from '../../../../components/ui/ListFooter';
import { StatusPlaceholder } from '../../../../components/ui/StatusPlaceholder';
import { showContextMenu } from '../../../../components/ui/ContextMenu/contextMenuManager';
import './index.scss';

/**
 * CompletedTab — 已完成 Tab
 *
 * 基于 SongTable 展示已下载歌曲列表，支持搜索过滤、播放、右键菜单。
 */
export function CompletedTab() {
    const { t } = useTranslation();

    const musicList = useCurrentMusicList();
    const isLoading = useIsLoadingSheet();

    const [searchValue, setSearchValue] = useState('');
    const deferredSearchValue = useDeferredValue(searchValue);

    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let aborted = false;
        setLoadError(false);
        setSearchValue('');
        musicSheet.openSheet(DOWNLOADED_SHEET_ID).catch(() => {
            if (!aborted) setLoadError(true);
        });
        return () => {
            aborted = true;
        };
    }, []);

    const filteredList = useMemo(() => {
        const raw = deferredSearchValue.trim();
        if (!raw) return musicList;
        const caseSensitive = appConfig.getConfigByKey('playMusic.caseSensitiveInSearch');
        const keyword = caseSensitive ? raw : raw.toLowerCase();
        const normalize = caseSensitive
            ? (s?: string) => s ?? ''
            : (s?: string) => (s ?? '').toLowerCase();
        return musicList.filter(
            (item) =>
                normalize(item.title).includes(keyword) ||
                normalize(item.artist).includes(keyword) ||
                normalize(item.album).includes(keyword),
        );
    }, [musicList, deferredSearchValue]);

    const handlePlayAll = useCallback(() => {
        if (filteredList.length === 0) return;
        trackPlayer.playMusicWithReplaceQueue(filteredList, {
            fromSheetId: DOWNLOADED_SHEET_ID,
        });
    }, [filteredList]);

    const isSearching = deferredSearchValue.trim().length > 0;

    const handleRowDoubleClick = useCallback(
        ({ item }: RowInteractionDetail) => {
            const behavior = appConfig.getConfigByKey('playMusic.clickMusicList');
            if (behavior === 'replace') {
                if (isSearching) {
                    trackPlayer.playMusicWithReplaceQueue(filteredList, {
                        startItem: item,
                    });
                } else {
                    const list = musicSheet.getCurrentMusicList();
                    trackPlayer.playMusicWithReplaceQueue(list, {
                        startItem: item,
                        fromSheetId: DOWNLOADED_SHEET_ID,
                    });
                }
            } else {
                trackPlayer.playMusic(item as IMusic.IMusicItem);
            }
        },
        [isSearching, filteredList],
    );

    const handleRowContextMenu = useCallback(
        ({ selectedItems }: RowInteractionDetail, e: MouseEvent) => {
            showContextMenu(
                'MusicItemMenu',
                { x: e.clientX, y: e.clientY },
                {
                    musicItems: selectedItems as IMusic.IMusicItem[],
                    sheetId: DOWNLOADED_SHEET_ID,
                },
            );
        },
        [],
    );

    const requestStatus = loadError
        ? RequestStatus.Error
        : isLoading
          ? RequestStatus.Pending
          : RequestStatus.Done;

    const isEmpty = !isLoading && !loadError && musicList.length === 0;

    const handleRetry = useCallback(() => {
        setLoadError(false);
        musicSheet.openSheet(DOWNLOADED_SHEET_ID).catch(() => setLoadError(true));
    }, []);

    return (
        <>
            <div className="p-download__toolbar">
                <SongToolbar
                    searchPlaceholder={t('download.search_placeholder')}
                    searchValue={searchValue}
                    disabled={isEmpty}
                    onSearchChange={setSearchValue}
                    onPlayAll={handlePlayAll}
                />
            </div>

            {isEmpty ? (
                <StatusPlaceholder
                    status={RequestStatus.Done}
                    isEmpty
                    emptyIcon={Download}
                    emptyTitle={t('download.empty_completed')}
                />
            ) : loadError ? (
                <StatusPlaceholder status={RequestStatus.Error} onRetry={handleRetry} />
            ) : (
                <SongTable
                    data={filteredList}
                    requestStatus={requestStatus}
                    onRetry={handleRetry}
                    statusColumn={(item) => (
                        <>
                            <FavoriteButton musicItem={item} size="sm" />
                            <DownloadButton musicItem={item} size="sm" />
                        </>
                    )}
                    onRowDoubleClick={handleRowDoubleClick}
                    onRowContextMenu={handleRowContextMenu}
                />
            )}

            {requestStatus === RequestStatus.Done && filteredList.length > 0 && (
                <ListFooter status={RequestStatus.Done} />
            )}
        </>
    );
}
