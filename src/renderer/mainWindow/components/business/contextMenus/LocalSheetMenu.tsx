import type { ContextMenuEntry } from '../../ui/ContextMenu';
import { showModal } from '../../ui/Modal/modalManager';
import playlistManager from '@infra/playlist/renderer';
import i18n from '@infra/i18n/renderer';
import { Pencil, Trash2 } from 'lucide-react';

export interface LocalPlaylistMenuContext {
    sheetId: string;
    sheetTitle: string;
}

/**
 * LocalSheetMenu — 本地歌单右键菜单模板
 *
 * 在 Sidebar 的「创建的歌单」列表上右键触发（仅非默认歌单）。
 * 提供重命名和删除操作。
 */
export function LocalPlaylistMenu(ctx: LocalPlaylistMenuContext): ContextMenuEntry[] {
    const { sheetId: playlistId, sheetTitle: playlistTitle } = ctx;

    return [
        {
            id: 'rename',
            icon: <Pencil />,
            label: i18n.t('playlist.rename_sheet'),
            onClick() {
                showModal('RenameSheetModal', {
                    sheetId: playlistId,
                    currentTitle: playlistTitle,
                });
            },
        },
        {
            id: 'delete',
            icon: <Trash2 />,
            label: i18n.t('playlist.delete_sheet'),
            danger: true,
            onClick() {
                showModal('ConfirmModal', {
                    title: i18n.t('playlist.delete_sheet'),
                    message: `${i18n.t('playlist.delete_sheet')}: ${playlistTitle}?`,
                    confirmDanger: true,
                    onConfirm: () => playlistManager.removePlaylist(playlistId),
                });
            },
        },
    ];
}
