/**
 * AlbumsTab — 专辑分类 Tab（master-detail 布局）
 *
 * 左侧：专辑列表（可滚动，带搜索过滤）
 * 右侧：选中专辑的歌曲列表（SongTable）
 *
 * 数据源：从 jotai store 同步读取，零 IPC。
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai/react';
import { cn } from '@common/cn';
import { RequestStatus } from '@common/constant';
import { SongTable } from '../../../components/business/SongTable';
import { StatusPlaceholder } from '../../../components/ui/StatusPlaceholder';
import { ScrollArea } from '../../../components/ui/ScrollArea';
import { useStatusColumn, useRowContextMenu, useSelection } from '../hooks';
import { filteredLocalMusicAtom, albumListAtom } from '../store';

interface AlbumsTabProps {
    isEmpty: boolean;
    searchKeyword: string;
}

export function AlbumsTab({ isEmpty, searchKeyword }: AlbumsTabProps) {
    const { t } = useTranslation();
    const [selectedAlbum, setSelectedAlbum] = useState<{ album: string; artist: string } | null>(
        null,
    );

    // ── 从 store 同步读取 ──
    const allSongs = useAtomValue(filteredLocalMusicAtom);
    const albums = useAtomValue(albumListAtom);

    // ── 过滤专辑列表 ──
    const filteredAlbums = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return albums;
        return albums.filter(
            (a) =>
                a.album.toLowerCase().includes(keyword) || a.artist.toLowerCase().includes(keyword),
        );
    }, [albums, searchKeyword]);

    // ── 自动选中第一项 ──
    const effectiveSelected = useMemo(() => {
        if (
            selectedAlbum &&
            filteredAlbums.some(
                (a) => a.album === selectedAlbum.album && a.artist === selectedAlbum.artist,
            )
        ) {
            return selectedAlbum;
        }
        return filteredAlbums.length > 0
            ? { album: filteredAlbums[0].album, artist: filteredAlbums[0].artist }
            : null;
    }, [selectedAlbum, filteredAlbums]);

    // ── 按选中专辑过滤歌曲（同步） ──
    const songsForAlbum = useMemo(() => {
        if (!effectiveSelected) return [];
        return allSongs.filter(
            (s) =>
                (s.album ?? '') === effectiveSelected.album &&
                s.artist === effectiveSelected.artist,
        );
    }, [allSongs, effectiveSelected]);

    // ── 搜索过滤歌曲 ──
    const filteredMusic = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return songsForAlbum;
        return songsForAlbum.filter((item) => item.title.toLowerCase().includes(keyword));
    }, [songsForAlbum, searchKeyword]);

    // ── 多选 ──
    const { selectionProps } = useSelection([
        effectiveSelected?.album,
        effectiveSelected?.artist,
        searchKeyword,
    ]);

    // ── 操作回调 ──
    const handleRowContextMenu = useRowContextMenu();
    const statusColumn = useStatusColumn();

    if (isEmpty) {
        return (
            <StatusPlaceholder
                status={RequestStatus.Done}
                isEmpty={isEmpty}
                emptyTitle={t('local_music.empty_title')}
                emptyDescription={t('local_music.empty_desc')}
            />
        );
    }

    return (
        <div className="p-local-music__split">
            {/* ── 左侧专辑列表 ── */}
            <ScrollArea className="p-local-music__split-master">
                {filteredAlbums.map((album) => {
                    const isActive =
                        effectiveSelected?.album === album.album &&
                        effectiveSelected?.artist === album.artist;
                    return (
                        <button
                            key={`${album.album}||${album.artist}`}
                            type="button"
                            className={cn('p-local-music__master-item', isActive && 'is-active')}
                            onClick={() =>
                                setSelectedAlbum({ album: album.album, artist: album.artist })
                            }
                        >
                            <span className="p-local-music__master-item-name">
                                {album.album || t('media.unknown_album')}
                            </span>
                            <span className="p-local-music__master-item-sub">
                                {album.artist || t('media.unknown_artist')}
                                {' · '}
                                {t('local_music.song_count', { count: album.count })}
                            </span>
                        </button>
                    );
                })}
            </ScrollArea>

            {/* ── 右侧歌曲列表 ── */}
            <div className="p-local-music__split-detail">
                {effectiveSelected !== null ? (
                    <SongTable
                        data={filteredMusic}
                        requestStatus={RequestStatus.Done}
                        onRowContextMenu={handleRowContextMenu}
                        statusColumn={statusColumn}
                        hideColumns={['platform', 'album']}
                        {...selectionProps}
                    />
                ) : (
                    <StatusPlaceholder
                        status={RequestStatus.Done}
                        isEmpty
                        emptyTitle={t('local_music.no_album_selected')}
                    />
                )}
            </div>
        </div>
    );
}
