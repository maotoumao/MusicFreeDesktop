import { useCallback, useMemo, type MouseEvent } from 'react';
import { ListMusic } from 'lucide-react';
import type { NavigateFunction } from 'react-router';
import { safeParse } from '@common/safeSerialize';
import { showContextMenu } from '../../ui/ContextMenu/contextMenuManager';
import { playlistRoute } from '../../../routes';
import type { IStarredPlaylistItem } from '@appTypes/infra/playlist';

interface StarredPlaylistNavItemProps {
    item: IStarredPlaylistItem;
    pathname: string;
    navigate: NavigateFunction;
}

export default function StarredPlaylistNavItem({
    item,
    pathname,
    navigate,
}: StarredPlaylistNavItemProps) {
    const playlistPath = playlistRoute(item.platform, item.id);
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
        navigate(playlistPath, { state: { sheetItem: fullItem } });
    }, [navigate, playlistPath, fullItem]);

    const handleContextMenu = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            showContextMenu(
                'StarredPlaylistMenu',
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
            className={`l-sidebar__nav-item${pathname === playlistPath ? ' is-active' : ''}`}
            type="button"
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <ListMusic size={16} className="l-sidebar__nav-icon l-sidebar__nav-icon--muted" />
            <span className="l-sidebar__nav-label">{item.title ?? fullItem.title}</span>
        </button>
    );
}
