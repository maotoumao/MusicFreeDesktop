import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import appConfig from '@infra/appConfig/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import { useDownloadTasks } from '@infra/downloadManager/renderer';
import { TabBar, type TabItem } from '../../components/ui/TabBar';
import { Button } from '../../components/ui/Button';
import { TaskTable } from './components/TaskTable';
import { CompletedTab } from './components/CompletedTab';
import './index.scss';

// ─── Tab 定义 ───

type DownloadTab = 'queue' | 'completed';

const TAB_ITEMS: TabItem[] = [
    { key: 'queue', label: '' },
    { key: 'completed', label: '' },
];

/**
 * DownloadPage — 下载管理页面
 *
 * 路由: /download
 *
 * 功能：
 *   - TabBar 切换两个 Tab：下载队列 / 已完成
 *   - 下载队列 Tab：自建表格，混合展示所有未完成任务（pending/downloading/paused/error）
 *   - 已完成 Tab：SongTable 复用 __downloaded__ 系统歌单
 *   - 打开下载文件夹按钮
 *
 * 设计稿还原（像素级）：
 *   页面: pt --space-4
 *   页头: title-size bold, flex justify-between
 *   TabBar: mt --space-6
 *   表格: body-size, text-secondary, header border-bottom border-subtle
 *   进度条: h 3px, bg fill-subtle → fill-brand / amber
 *   操作按钮: 30×30, rounded-full, text-muted hover:text-primary
 */
export default function DownloadPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<DownloadTab>('queue');

    const tabItems = useMemo<TabItem[]>(
        () =>
            TAB_ITEMS.map((item) => ({
                ...item,
                label: t(`download.tab_${item.key}`),
            })),
        [t],
    );

    const queueTasks = useDownloadTasks();

    const handleOpenFolder = useCallback(() => {
        const downloadPath =
            appConfig.getConfigByKey('download.path') ||
            window.globalContext.appPath.defaultDownloadPath;
        systemUtil.openPath(downloadPath);
    }, []);

    return (
        <div className="p-download">
            {/* ── 页头 ── */}
            <div className="p-download__header">
                <h2 className="p-download__title">{t('download.title')}</h2>
                <Button
                    variant="secondary"
                    size="md"
                    icon={<FolderOpen size={16} />}
                    onClick={handleOpenFolder}
                >
                    {t('download.open_download_folder')}
                </Button>
            </div>

            {/* ── TabBar ── */}
            <div className="p-download__tab-bar">
                <TabBar
                    items={tabItems}
                    activeKey={activeTab}
                    onChange={(k) => setActiveTab(k as DownloadTab)}
                />
            </div>

            {/* ── Tab 内容 ── */}
            <div className="p-download__body">
                {activeTab === 'queue' && <TaskTable tasks={queueTasks} />}
                {activeTab === 'completed' && <CompletedTab />}
            </div>
        </div>
    );
}
