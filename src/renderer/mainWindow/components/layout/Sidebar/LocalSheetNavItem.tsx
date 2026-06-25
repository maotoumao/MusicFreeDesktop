import { useCallback, type MouseEvent } from 'react';
import { ListMusic, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NavigateFunction } from 'react-router';
import { DEFAULT_FAVORITE_SHEET_ID } from '@infra/musicSheet/common/constant';
import { showContextMenu } from '../../ui/ContextMenu/contextMenuManager';
import { localSheetRoute } from '../../../routes';
import type { ILocalSheetMeta } from '@appTypes/infra/musicSheet';

interface LocalSheetNavItemProps {
    sheet: ILocalSheetMeta;
    pathname: string;
    navigate: NavigateFunction;
}

export default function LocalSheetNavItem({ sheet, pathname, navigate }: LocalSheetNavItemProps) {
    const { t } = useTranslation();
    const isFavorite = sheet.id === DEFAULT_FAVORITE_SHEET_ID;
    const Icon = isFavorite ? Heart : ListMusic;
    const sheetPath = localSheetRoute(sheet.id);

    const handleClick = useCallback(() => {
        navigate(sheetPath);
    }, [navigate, sheetPath]);

    const handleContextMenu = useCallback(
        (e: MouseEvent) => {
            if (isFavorite) return;
            e.preventDefault();
            showContextMenu(
                'LocalSheetMenu',
                { x: e.clientX, y: e.clientY },
                {
                    sheetId: sheet.id,
                    sheetTitle: sheet.title,
                },
            );
        },
        [isFavorite, sheet.id, sheet.title],
    );

    return (
        <button
            className={`l-sidebar__nav-item${pathname === sheetPath ? ' is-active' : ''}`}
            type="button"
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <Icon
                size={16}
                className={`l-sidebar__nav-icon${isFavorite ? '' : ' l-sidebar__nav-icon--muted'}`}
            />
            <span className="l-sidebar__nav-label">
                {isFavorite ? t('media.default_favorite_sheet_name') : sheet.title}
            </span>
        </button>
    );
}
