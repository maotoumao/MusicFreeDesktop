/**
 * RecommendSheetsPage — 热门歌单页
 *
 * 路由: /recommend-sheets
 *
 * 布局：
 *   标题  "热门歌单"
 *   TabBar  支持 getRecommendSheetsByTag 的插件列表
 *   TagFilter  标签筛选栏（默认 + pinned + 下拉面板）
 *   MediaGrid  歌单卡片网格（支持分页加载）
 *
 * 无可用插件时展示 PluginFeatureUnavailable。
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortedSupportedPlugins } from '@infra/pluginManager/renderer/hooks';
import { PluginFeatureUnavailable } from '../../components/business/PluginFeatureUnavailable';
import { TabBar } from '../../components/ui/TabBar';
import { RecommendSheetsBody } from './RecommendSheetsBody';
import './index.scss';

export default function RecommendSheetsPage() {
    const { t } = useTranslation();
    const availablePlugins = useSortedSupportedPlugins('getRecommendSheetsByTag');
    const [activeHash, setActiveHash] = useState('');

    const currentHash = useMemo(() => {
        if (activeHash && availablePlugins.some((p) => p.hash === activeHash)) {
            return activeHash;
        }
        return availablePlugins[0]?.hash ?? '';
    }, [activeHash, availablePlugins]);

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
            <div className="p-recommend-sheets">
                <h2 className="p-recommend-sheets__title">{t('playlist.recommend')}</h2>
                <PluginFeatureUnavailable featureName={t('playlist.recommend')} />
            </div>
        );
    }

    return (
        <div className="p-recommend-sheets">
            <h2 className="p-recommend-sheets__title">{t('playlist.recommend')}</h2>

            <div className="p-recommend-sheets__tabs">
                <TabBar items={tabItems} activeKey={currentHash} onChange={handleTabChange} />
            </div>

            <RecommendSheetsBody pluginHash={currentHash} />
        </div>
    );
}
