import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import themePack, { useCurrentThemePack, useInstalledThemePacks } from '@infra/themepack/renderer';
import type { IThemePack } from '@appTypes/infra/themepack';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import { showContextMenu } from '@renderer/mainWindow/components/ui/ContextMenu/contextMenuManager';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { ThemeCard } from '../ThemeCard';
import { ThemePreview } from '../ThemePreview';
import './index.scss';

/**
 * LocalThemes — 已安装主题列表
 *
 * grid 布局展示本地已安装的主题卡片，
 * 首项固定为「默认主题」（null 值），其余为用户安装的主题。
 */
export default function LocalThemes() {
    const { t } = useTranslation();
    const installedPacks = useInstalledThemePacks();
    const currentPack = useCurrentThemePack();

    const handleSelect = useCallback(async (pack: IThemePack | null) => {
        await themePack.selectTheme(pack);
    }, []);

    const handleUninstall = useCallback(
        (pack: IThemePack) => {
            showModal('ConfirmModal', {
                title: t('theme.uninstall_theme'),
                message: t('theme.confirm_uninstall_message', { name: pack.name }),
                confirmDanger: true,
                onConfirm: async () => {
                    try {
                        await themePack.uninstallThemePack(pack);
                        showToast(t('theme.uninstall_theme_success', { name: pack.name }));
                    } catch {
                        showToast(t('theme.uninstall_theme_fail', { reason: 'unknown' }), {
                            type: 'warn',
                        });
                    }
                },
            });
        },
        [t],
    );

    const isDefaultActive = currentPack === null;

    return (
        <div className="local-themes">
            {/* 默认主题卡片 */}
            <ThemeCard
                name={t('theme.default_theme')}
                author="猫头猫"
                active={isDefaultActive}
                preview={
                    <ThemePreview
                        name={t('theme.default_theme')}
                        isActive={isDefaultActive}
                        isDefault
                    />
                }
                footer={
                    !isDefaultActive ? (
                        <Button variant="secondary" size="sm" onClick={() => handleSelect(null)}>
                            {t('theme.use_theme')}
                        </Button>
                    ) : undefined
                }
                onClick={() => handleSelect(null)}
            />

            {/* 已安装主题卡片 */}
            {installedPacks.map((pack) => {
                const isActive = currentPack?.hash === pack.hash;
                const hasActions = !isActive || !pack.builtin;

                return (
                    <ThemeCard
                        key={pack.hash}
                        name={pack.name}
                        author={pack.author}
                        active={isActive}
                        preview={
                            <ThemePreview
                                preview={pack.preview}
                                thumb={pack.thumb}
                                name={pack.name}
                                isActive={isActive}
                            />
                        }
                        footer={
                            hasActions ? (
                                <div className="local-themes__actions">
                                    {!isActive && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelect(pack);
                                            }}
                                        >
                                            {t('theme.use_theme')}
                                        </Button>
                                    )}
                                    {!pack.builtin && (
                                        <Button
                                            variant="icon"
                                            size="sq"
                                            className="local-themes__delete-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUninstall(pack);
                                            }}
                                            icon={<Trash2 width={16} height={16} />}
                                        />
                                    )}
                                </div>
                            ) : undefined
                        }
                        onClick={() => handleSelect(pack)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            showContextMenu(
                                'LocalThemeMenu',
                                { x: e.clientX, y: e.clientY },
                                { pack },
                            );
                        }}
                    />
                );
            })}
        </div>
    );
}
