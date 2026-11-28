import { useCallback } from 'react';
import { FavoriteButton } from '../../../components/business/FavoriteButton';
import { DownloadButton } from '../../../components/business/DownloadButton';

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
