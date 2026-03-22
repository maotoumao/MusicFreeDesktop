import { useState, useMemo, useCallback } from 'react';
import { FolderPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TabBar, type TabItem } from '@renderer/mainWindow/components/ui/TabBar';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import systemUtil from '@infra/systemUtil/renderer';
import themePack from '@infra/themepack/renderer';
import LocalThemes from './components/LocalThemes';
import RemoteThemes from './components/RemoteThemes';
import './index.scss';

/**
 * ThemePage — 主题广场页面
 *
 * 顶部固定标题 + TabBar（本地主题 / 主题市场），
 * 下方独立滚动内容区展示主题卡片 grid。
 *
 * 设计稿还原（像素级）：
 *   布局: flex column, height 100%, 参考 SettingPage
 *   标题: text-title (24px), font-bold, text-primary
 *   TabBar: 两个 tab，右侧本地安装按钮
 *   Grid: repeat(auto-fill, minmax(220px, 1fr)), gap space-6
 */
export default function ThemePage() {
    const { t } = useTranslation();
    const [activeKey, setActiveKey] = useState('local');

    const tabs: TabItem[] = useMemo(
        () => [
            { key: 'local', label: t('theme.tab_local') },
            { key: 'remote', label: t('theme.tab_remote') },
        ],
        [t],
    );

    const handleInstallLocal = useCallback(async () => {
        const result = await systemUtil.showOpenDialog({
            filters: [
                {
                    name: t('theme.musicfree_theme'),
                    extensions: ['mftheme', 'zip'],
                },
                { name: t('theme.all_files'), extensions: ['*'] },
            ],
            properties: ['openFile', 'multiSelections'],
        });

        if (result.canceled || result.filePaths.length === 0) return;

        for (const filePath of result.filePaths) {
            try {
                const tp = await themePack.installThemePack(filePath);
                if (tp) {
                    showToast(t('theme.install_theme_success', { name: tp.name }));
                } else {
                    showToast(t('theme.install_theme_fail', { reason: 'invalid' }), {
                        type: 'warn',
                    });
                }
            } catch {
                showToast(t('theme.install_theme_fail', { reason: 'unknown' }), { type: 'warn' });
            }
        }
    }, [t]);

    const sectionContent = useMemo(() => {
        if (activeKey === 'local') return <LocalThemes />;
        return <RemoteThemes />;
    }, [activeKey]);

    return (
        <div className="p-theme">
            {/* 非滚动区域：标题 + TabBar */}
            <div className="p-theme__header">
                <div className="p-theme__title-row">
                    <h2 className="p-theme__title">{t('theme.title')}</h2>
                    {activeKey === 'local' && (
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<FolderPlus width={14} height={14} />}
                            onClick={handleInstallLocal}
                        >
                            {t('theme.install_theme')}
                        </Button>
                    )}
                </div>
                <TabBar items={tabs} activeKey={activeKey} onChange={setActiveKey} />
            </div>

            {/* 独立滚动区域 */}
            <section className="p-theme__body">{sectionContent}</section>
        </div>
    );
}
