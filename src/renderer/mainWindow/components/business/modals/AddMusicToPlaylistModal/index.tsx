import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Music } from 'lucide-react';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { ScrollArea } from '@renderer/mainWindow/components/ui/ScrollArea';
import { Artwork } from '@renderer/mainWindow/components/ui/Artwork';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import playlistManager, { usePlaylistList } from '@infra/playlist/renderer';
import {
    DEFAULT_FAVORITE_PLAYLIST_ID,
    MAX_MUSIC_PER_PLAYLIST,
} from '@infra/playlist/common/constant';
import './index.scss';

export interface AddMusicToPlaylistModalProps {
    close: () => void;
    /** 要添加的歌曲（支持单曲与多曲） */
    musicItems: IMusic.IMusicItem[];
}

/**
 * AddMusicToPlaylistModal — 添加歌曲到歌单
 *
 * 列出所有用户歌单（含"我喜欢"），点击即添加并关闭。
 * 顶部"新建歌单"入口：关闭当前弹窗，打开 CreatePlaylistModal。
 */
export default function AddMusicToPlaylistModal({
    close,
    musicItems,
}: AddMusicToPlaylistModalProps) {
    const { t } = useTranslation();
    const playlists = usePlaylistList();

    const handleSelectPlaylist = useCallback(
        (playlistId: string, playlistTitle: string, worksNum: number) => {
            close();
            const limitReached = () =>
                showToast(t('playlist.limit_reached', { count: MAX_MUSIC_PER_PLAYLIST }), {
                    type: 'warn',
                });
            if (worksNum >= MAX_MUSIC_PER_PLAYLIST) {
                limitReached();
                return;
            }
            playlistManager.addMusicToPlaylist(musicItems, playlistId).then(
                ({ truncated }) => {
                    if (truncated > 0) {
                        limitReached();
                    } else {
                        showToast(t('playlist.added_to_sheet', { sheet: playlistTitle }), {
                            type: 'success',
                        });
                    }
                },
                () => showToast(t('playlist.add_music_failed'), { type: 'error' }),
            );
        },
        [musicItems, close, t],
    );

    const handleCreatePlaylist = useCallback(() => {
        close();
        showModal('CreatePlaylistModal', { initMusicItems: musicItems });
    }, [close, musicItems]);

    return (
        <Modal
            open
            onClose={close}
            title={t('playlist.add_to_sheet_menu')}
            subtitle={t('playlist.selected_count', { count: musicItems.length })}
            size="md"
        >
            <div className="add-music-to-sheet-modal">
                <ScrollArea className="add-music-to-sheet-modal__list">
                    {/* ── 新建歌单 ── */}
                    <button
                        type="button"
                        className="add-music-to-sheet-modal__item add-music-to-sheet-modal__item--create"
                        onClick={handleCreatePlaylist}
                    >
                        <div className="add-music-to-sheet-modal__item-artwork add-music-to-sheet-modal__item-artwork--create">
                            <Plus size={18} />
                        </div>
                        <span className="add-music-to-sheet-modal__item-title">
                            {t('playlist.create_sheet')}
                        </span>
                    </button>

                    {/* ── 歌单列表 ── */}
                    {playlists.map((playlist) => {
                        const isFavorite = playlist.id === DEFAULT_FAVORITE_PLAYLIST_ID;
                        const displayTitle = isFavorite
                            ? t('media.default_favorite_sheet_name')
                            : playlist.title;

                        return (
                            <button
                                key={playlist.id}
                                type="button"
                                className="add-music-to-sheet-modal__item"
                                onClick={() =>
                                    handleSelectPlaylist(
                                        playlist.id,
                                        displayTitle,
                                        playlist.worksNum ?? 0,
                                    )
                                }
                            >
                                <Artwork
                                    className="add-music-to-sheet-modal__item-artwork"
                                    src={playlist.artwork ?? playlist.latestArtwork ?? undefined}
                                    rounded="sm"
                                    size="sm"
                                    style={{ width: 36, height: 36 }}
                                />
                                <span className="add-music-to-sheet-modal__item-title">
                                    {displayTitle}
                                </span>
                                <span className="add-music-to-sheet-modal__item-count">
                                    {playlist.worksNum ?? 0}
                                    <Music size={12} />
                                </span>
                            </button>
                        );
                    })}

                    {playlists.length === 0 && (
                        <div className="add-music-to-sheet-modal__empty">
                            {t('status.hint_empty')}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </Modal>
    );
}
