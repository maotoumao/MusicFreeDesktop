import type { ContextMenuEntry } from '../../ui/ContextMenu';
import musicSheet from '@infra/musicSheet/renderer';
import i18n from '@infra/i18n/renderer';
import { Trash2 } from 'lucide-react';

export interface StarredSheetMenuContext {
    sheetItem: IMedia.IMediaBase;
}

/**
 * StarredSheetMenu — 收藏歌单右键菜单模板
 *
 * 在 Sidebar 的收藏歌单列表上右键触发，提供取消收藏操作。
 */
export function StarredSheetMenu(ctx: StarredSheetMenuContext): ContextMenuEntry[] {
    const { sheetItem } = ctx;

    return [
        {
            id: 'unstar',
            icon: <Trash2 />,
            label: i18n.t('playlist.unstar'),
            danger: true,
            onClick() {
                musicSheet.unstarMusicSheet(sheetItem);
            },
        },
    ];
}
