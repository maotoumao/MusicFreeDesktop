import { Rss, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import { usePlugins } from '@infra/pluginManager/renderer/hooks';
import pluginManager from '@infra/pluginManager/renderer';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { LOCAL_PLUGIN_HASH } from '@common/constant';
import PluginList from './components/PluginList';
import './index.scss';

/**
 * PluginManagerPage — 插件管理页面
 *
 * 顶部固定标题 + 操作栏，下方为可拖拽排序的插件列表。
 * 设计稿还原：Plugins.tsx (设计稿)
 */
export default function PluginManagerPage() {
    const { t } = useTranslation();
    const plugins = usePlugins();
    const pluginCount = useMemo(
        () => plugins.filter((p) => p.hash !== LOCAL_PLUGIN_HASH).length,
        [plugins],
    );

    const handleUninstallAll = useCallback(() => {
        showModal('ConfirmModal', {
            title: t('plugin.uninstall_all'),
            message: t('plugin.uninstall_warning'),
            description: t('plugin.confirm_text_uninstall_all', { count: pluginCount }),
            confirmText: t('plugin.confirm_uninstall'),
            confirmDanger: true,
            onConfirm: async () => {
                const count = await pluginManager.uninstallAllPlugins();
                showToast(t('plugin.uninstall_all_success', { count }));
            },
        });
    }, [pluginCount, t]);

    return (
        <div className="p-plugin-manager">
            {/* 头部：标题 + 操作按钮 */}
            <div className="p-plugin-manager__header">
                <div className="p-plugin-manager__title-group">
                    <h2 className="p-plugin-manager__title">{t('plugin.plugin_management')}</h2>
                    {pluginCount > 0 && (
                        <span className="p-plugin-manager__count">
                            {t('plugin.plugin_count', { count: pluginCount })}
                        </span>
                    )}
                </div>
                <div className="p-plugin-manager__header-actions">
                    {pluginCount > 0 && (
                        <Button
                            variant="secondary"
                            size="md"
                            icon={<Trash2 size={16} />}
                            onClick={handleUninstallAll}
                        >
                            {t('plugin.uninstall_all')}
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        size="md"
                        icon={<Rss size={16} />}
                        onClick={() => showModal('PluginSubscriptionModal')}
                    >
                        {t('plugin.subscription_setting')}
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        icon={<Plus size={16} />}
                        onClick={() => showModal('PluginInstallModal')}
                    >
                        {t('plugin.install_plugin')}
                    </Button>
                </div>
            </div>

            {/* 插件列表 */}
            <div className="p-plugin-manager__body">
                <PluginList />
            </div>
        </div>
    );
}
