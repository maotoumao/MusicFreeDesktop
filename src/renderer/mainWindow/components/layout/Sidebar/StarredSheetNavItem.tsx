import { useCallback, useMemo, type MouseEvent } from 'react';
import { ListMusic } from 'lucide-react';
import type { NavigateFunction } from 'react-router';
import { safeParse } from '@common/safeSerialize';
import { showContextMenu } from '../../ui/ContextMenu/contextMenuManager';
import { musicSheetRoute } from '../../../routes';
import type { IStarredPlaylistItem } from '@appTypes/infra/musicSheet';

interface StarredPlaylistNavItemProps {
    item: IStarredPlaylistItem;
    pathname: string;
    navigate: NavigateFunction;
}

export default function StarredSheetNavItem({
    item,
    pathname,
    navigate,
}: StarredPlaylistNavItemProps) {
    const sheetPath = musicSheetRoute(item.platform, item.id);
    const fullItem = useMemo(
        () =>
            safeParse<IMusic.IPlaylistItem>(item.raw) ?? {
                platform: item.platform,
                id: item.id,
                title: item.title ?? '',
            },
        [item.raw, item.platform, item.id, item.title],
    );

    const handleClick = useCallback(() => {
        navigate(sheetPath, { state: { sheetItem: fullItem } });
    }, [navigate, sheetPath, fullItem]);

    const handleContextMenu = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            showContextMenu(
                'StarredSheetMenu',
                { x: e.clientX, y: e.clientY },
                {
                    sheetItem: { platform: item.platform, id: item.id },
                },
            );
        },
        [item.platform, item.id],
    );

    return (
        <button
            className={`l-sidebar__nav-item${pathname === sheetPath ? ' is-active' : ''}`}
            type="button"
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <ListMusic size={16} className="l-sidebar__nav-icon l-sidebar__nav-icon--muted" />
            <span className="l-sidebar__nav-label">{item.title ?? fullItem.title}</span>
        </button>
    );
}
