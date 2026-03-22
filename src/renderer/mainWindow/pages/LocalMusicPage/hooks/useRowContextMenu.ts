import { useCallback, type MouseEvent } from 'react';
import { showContextMenu } from '../../../components/ui/ContextMenu/contextMenuManager';
import type { RowInteractionDetail } from '../../../components/business/SongTable';

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
