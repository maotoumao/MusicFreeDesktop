/**
 * Shared hooks for LocalMusicPage sub-tabs
 *
 * Extracts commonly duplicated callbacks to avoid repeating the same
 * useCallback + import boilerplate across ArtistsTab / AlbumsTab / FoldersTab.
 */

import { useCallback, type MouseEvent } from 'react';
import { FavoriteButton } from '../../components/business/FavoriteButton';
import { DownloadButton } from '../../components/business/DownloadButton';
import { showContextMenu } from '../../components/ui/ContextMenu/contextMenuManager';
import type { RowInteractionDetail } from '../../components/business/SongTable';

/**
 * Status column renderer (❤ + ⬇) shared by all local music song tables.
 */
export function useStatusColumn() {
    return useCallback(
        (item: IMusic.IMusicItemBase) => (
            <>
                <FavoriteButton musicItem={item as IMusic.IMusicItem} />
                <DownloadButton musicItem={item as IMusic.IMusicItem} />
            </>
        ),
        [],
    );
}

/**
 * Right-click handler that opens the standard MusicItemMenu.
 */
export function useRowContextMenu() {
    return useCallback(({ selectedItems }: RowInteractionDetail, e: MouseEvent) => {
        showContextMenu(
            'MusicItemMenu',
            { x: e.clientX, y: e.clientY },
            { musicItems: selectedItems as IMusic.IMusicItem[] },
        );
    }, []);
}
