/**
 * ToplistPage — 排行榜页
 *
 * 路由: /toplist
 *
 * 布局：
 *   标题  "排行榜"
 *   TabBar  支持 getTopLists 的插件列表
 *   Body    当前插件的分组榜单卡片网格
 *
 * 无可用插件时展示 PluginFeatureUnavailable。
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortedSupportedPlugins } from '@infra/pluginManager/renderer/hooks';
import { PluginFeatureUnavailable } from '../../components/business/PluginFeatureUnavailable';
import { TabBar } from '../../components/ui/TabBar';
import { ToplistBody } from './ToplistBody';
import './index.scss';

export default function ToplistPage() {
    const { t } = useTranslation();
    const availablePlugins = useSortedSupportedPlugins('getTopLists');
    const [activeHash, setActiveHash] = useState('');

    // 确保 activeHash 有效
    const currentHash = useMemo(() => {
        if (activeHash && availablePlugins.some((p) => p.hash === activeHash)) {
            return activeHash;
        }
        return availablePlugins[0]?.hash ?? '';
    }, [activeHash, availablePlugins]);

    const currentPlugin = useMemo(
        () => availablePlugins.find((p) => p.hash === currentHash),
        [availablePlugins, currentHash],
    );

    const tabItems = useMemo(
        () =>
            availablePlugins.map((p) => ({
                key: p.hash,
                label: p.platform,
            })),
        [availablePlugins],
    );

    const handleTabChange = useCallback((key: string) => {
        setActiveHash(key);
    }, []);

    // 无插件支持此功能
    if (availablePlugins.length === 0) {
        return (
            <div className="p-toplist">
                <h2 className="p-toplist__title">{t('toplist.title')}</h2>
                <PluginFeatureUnavailable featureName={t('toplist.title')} />
            </div>
        );
    }

    return (
        <div className="p-toplist">
            <h2 className="p-toplist__title">{t('toplist.title')}</h2>

            <div className="p-toplist__tabs">
                <TabBar items={tabItems} activeKey={currentHash} onChange={handleTabChange} />
            </div>

            {currentPlugin && (
                <ToplistBody pluginHash={currentHash} pluginPlatform={currentPlugin.platform} />
            )}
        </div>
    );
}
