import type { ContextMenuEntry } from '../../ui/ContextMenu';
import type { IThemePack } from '@appTypes/infra/themepack';
import { showModal } from '../../ui/Modal/modalManager';
import systemUtil from '@infra/systemUtil/renderer';
import themePack from '@infra/themepack/renderer';
import i18n from '@infra/i18n/renderer';
import { ExternalLink, Eye, Trash2 } from 'lucide-react';
import { showToast } from '../../ui/Toast';

export interface LocalThemeMenuContext {
    pack: IThemePack;
}

/**
 * LocalThemeMenu — 本地已安装主题右键菜单模板
 *
 * 提供查看作者主页、预览、卸载操作。
 */
export function LocalThemeMenu(ctx: LocalThemeMenuContext): ContextMenuEntry[] {
    const { pack } = ctx;
    const entries: ContextMenuEntry[] = [];

    // 查看作者（有 authorUrl 时显示）
    if (pack.authorUrl) {
        entries.push({
            id: 'view-author',
            icon: <ExternalLink />,
            label: i18n.t('theme.view_author'),
            onClick() {
                systemUtil.openExternal(pack.authorUrl!);
            },
        });
    }

    // 预览
    entries.push({
        id: 'preview',
        icon: <Eye />,
        label: i18n.t('theme.preview'),
        onClick() {
            showModal('ThemeDetailModal', {
                name: pack.name,
                author: pack.author,
                authorUrl: pack.authorUrl,
                description: pack.description,
                version: pack.version,
                preview: pack.preview,
                onInstall: async () => {
                    await themePack.selectTheme(pack);
                },
                installLabel: i18n.t('theme.use_theme'),
            });
        },
    });

    // 卸载（非内置主题）
    if (!pack.builtin) {
        entries.push({ type: 'separator' });
        entries.push({
            id: 'uninstall',
            icon: <Trash2 />,
            label: i18n.t('theme.uninstall_theme'),
            danger: true,
            onClick() {
                showModal('ConfirmModal', {
                    title: i18n.t('theme.uninstall_theme'),
                    message: i18n.t('theme.confirm_uninstall_message', {
                        name: pack.name,
                    }),
                    confirmDanger: true,
                    onConfirm: async () => {
                        try {
                            await themePack.uninstallThemePack(pack);
                            showToast(
                                i18n.t('theme.uninstall_theme_success', {
                                    name: pack.name,
                                }),
                            );
                        } catch {
                            showToast(
                                i18n.t('theme.uninstall_theme_fail', {
                                    reason: 'unknown',
                                }),
                                { type: 'warn' },
                            );
                        }
                    },
                });
            },
        });
    }

    return entries;
}
