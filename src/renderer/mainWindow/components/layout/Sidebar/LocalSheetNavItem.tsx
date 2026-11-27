import { useCallback, type MouseEvent } from 'react';
import { ListMusic, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NavigateFunction } from 'react-router';
import { DEFAULT_FAVORITE_PLAYLIST_ID } from '@infra/playlist/common/constant';
import { showContextMenu } from '../../ui/ContextMenu/contextMenuManager';
import { localPlaylistRoute } from '../../../routes';
import type { ILocalPlaylistMeta } from '@appTypes/infra/playlist';

interface LocalPlaylistNavItemProps {
    sheet: ILocalPlaylistMeta;
    pathname: string;
    navigate: NavigateFunction;
}

export default function LocalPlaylistNavItem({
    sheet: playlist,
    pathname,
    navigate,
}: LocalPlaylistNavItemProps) {
    const { t } = useTranslation();
    const isFavorite = playlist.id === DEFAULT_FAVORITE_PLAYLIST_ID;
    const Icon = isFavorite ? Heart : ListMusic;
    const playlistPath = localPlaylistRoute(playlist.id);

    const handleClick = useCallback(() => {
        navigate(playlistPath);
    }, [navigate, playlistPath]);

    const handleContextMenu = useCallback(
        (e: MouseEvent) => {
            if (isFavorite) return;
            e.preventDefault();
            showContextMenu(
                'LocalSheetMenu',
                { x: e.clientX, y: e.clientY },
                {
                    sheetId: playlist.id,
                    sheetTitle: playlist.title,
                },
            );
        },
        [isFavorite, playlist.id, playlist.title],
    );

    return (
        <button
            className={`l-sidebar__nav-item${pathname === playlistPath ? ' is-active' : ''}`}
            type="button"
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <Icon
                size={16}
                className={`l-sidebar__nav-icon${isFavorite ? '' : ' l-sidebar__nav-icon--muted'}`}
            />
            <span className="l-sidebar__nav-label">
                {isFavorite ? t('media.default_favorite_sheet_name') : playlist.title}
            </span>
        </button>
    );
}
