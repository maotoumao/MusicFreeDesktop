/**
 * ArtistsTab — 歌手分类 Tab（master-detail 布局）
 *
 * 左侧：歌手列表（可滚动，带搜索过滤）
 * 右侧：选中歌手的歌曲列表（SongTable）
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
import { useStatusColumn, useRowContextMenu } from '../shared';
import { filteredLocalMusicAtom, artistListAtom } from '../store';

interface ArtistsTabProps {
    isEmpty: boolean;
    searchKeyword: string;
}

export function ArtistsTab({ isEmpty, searchKeyword }: ArtistsTabProps) {
    const { t } = useTranslation();
    const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

    // ── 从 store 同步读取 ──
    const allSongs = useAtomValue(filteredLocalMusicAtom);
    const artists = useAtomValue(artistListAtom);

    // ── 过滤歌手列表 ──
    const filteredArtists = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return artists;
        return artists.filter((a) => a.artist.toLowerCase().includes(keyword));
    }, [artists, searchKeyword]);

    // ── 自动选中第一项 ──
    const effectiveSelected = useMemo(() => {
        if (selectedArtist !== null && filteredArtists.some((a) => a.artist === selectedArtist)) {
            return selectedArtist;
        }
        return filteredArtists.length > 0 ? filteredArtists[0].artist : null;
    }, [selectedArtist, filteredArtists]);

    // ── 按选中歌手过滤歌曲（同步） ──
    const songsForArtist = useMemo(() => {
        if (effectiveSelected === null) return [];
        return allSongs.filter((s) => s.artist === effectiveSelected);
    }, [allSongs, effectiveSelected]);

    // ── 搜索过滤歌曲 ──
    const filteredMusic = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return songsForArtist;
        return songsForArtist.filter(
            (item) =>
                item.title.toLowerCase().includes(keyword) ||
                (item.album ?? '').toLowerCase().includes(keyword),
        );
    }, [songsForArtist, searchKeyword]);

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
            {/* ── 左侧歌手列表 ── */}
            <ScrollArea className="p-local-music__split-master">
                {filteredArtists.map((artist) => (
                    <button
                        key={artist.artist}
                        type="button"
                        className={cn(
                            'p-local-music__master-item',
                            effectiveSelected === artist.artist && 'is-active',
                        )}
                        onClick={() => setSelectedArtist(artist.artist)}
                    >
                        <span className="p-local-music__master-item-name">
                            {artist.artist || t('media.unknown_artist')}
                        </span>
                        <span className="p-local-music__master-item-count">
                            {t('local_music.song_count', { count: artist.count })}
                        </span>
                    </button>
                ))}
            </ScrollArea>

            {/* ── 右侧歌曲列表 ── */}
            <div className="p-local-music__split-detail">
                {effectiveSelected !== null ? (
                    <SongTable
                        data={filteredMusic}
                        requestStatus={RequestStatus.Done}
                        onRowContextMenu={handleRowContextMenu}
                        statusColumn={statusColumn}
                        hideColumns={['platform', 'artist']}
                    />
                ) : (
                    <StatusPlaceholder
                        status={RequestStatus.Done}
                        isEmpty
                        emptyTitle={t('local_music.no_artist_selected')}
                    />
                )}
            </div>
        </div>
    );
}
