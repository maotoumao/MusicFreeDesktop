import type { ContextMenuEntry } from '../../ui/ContextMenu';
import playlistManager from '@infra/playlist/renderer';
import i18n from '@infra/i18n/renderer';
import { Trash2 } from 'lucide-react';

export interface StarredPlaylistMenuContext {
    sheetItem: IMedia.IMediaBase;
}

/**
 * StarredPlaylistMenu — 收藏歌单右键菜单模板
 *
 * 在 Sidebar 的收藏歌单列表上右键触发，提供取消收藏操作。
 */
export function StarredPlaylistMenu(ctx: StarredPlaylistMenuContext): ContextMenuEntry[] {
    const { sheetItem: playlistItem } = ctx;

    return [
        {
            id: 'unstar',
            icon: <Trash2 />,
            label: i18n.t('playlist.unstar'),
            danger: true,
            onClick() {
                playlistManager.unstarPlaylist(playlistItem);
            },
        },
    ];
}
