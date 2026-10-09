import type { ContextMenuEntry } from '../../ui/ContextMenu';
import { showModal } from '../../ui/Modal/modalManager';
import musicSheet from '@infra/musicSheet/renderer';
import i18n from '@infra/i18n/renderer';
import { Pencil, Trash2 } from 'lucide-react';

export interface LocalSheetMenuContext {
    sheetId: string;
    sheetTitle: string;
}

/**
 * LocalSheetMenu — 本地歌单右键菜单模板
 *
 * 在 Sidebar 的「创建的歌单」列表上右键触发（仅非默认歌单）。
 * 提供重命名和删除操作。
 */
export function LocalSheetMenu(ctx: LocalSheetMenuContext): ContextMenuEntry[] {
    const { sheetId, sheetTitle } = ctx;

    return [
        {
            id: 'rename',
            icon: <Pencil />,
            label: i18n.t('playlist.rename_sheet'),
            onClick() {
                showModal('RenameSheetModal', {
                    sheetId,
                    currentTitle: sheetTitle,
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
                    message: `${i18n.t('playlist.delete_sheet')}: ${sheetTitle}?`,
                    confirmDanger: true,
                    onConfirm: () => musicSheet.removeSheet(sheetId),
                });
            },
        },
    ];
}
