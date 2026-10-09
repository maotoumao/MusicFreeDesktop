import { Rss, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import { usePlugins } from '@infra/pluginManager/renderer/hooks';
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
