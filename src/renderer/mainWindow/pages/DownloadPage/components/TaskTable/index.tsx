import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { RequestStatus } from '@common/constant';
import formatFileSize from '@common/formatFileSize';
import { StatusPlaceholder } from '../../../../components/ui/StatusPlaceholder';
import { DownloadProgressCell } from '../DownloadProgressCell';
import { TaskActions } from '../TaskActions';
import type { IDownloadTask } from '@appTypes/infra/downloadManager';
import './index.scss';

// ─── 子组件：任务行 ───

const TaskRow = memo(function TaskRow({ task }: { task: IDownloadTask }) {
    const { t } = useTranslation();
    const isActive = task.status === 'downloading' || task.status === 'paused';

    return (
        <tr className="p-download__row">
            <td className="p-download__cell p-download__cell--title">
                <div className="p-download__title-wrapper">
                    <span className="p-download__song-title">{task.title}</span>
                </div>
            </td>
            <td className="p-download__cell p-download__cell--artist">{task.artist}</td>
            <td className="p-download__cell p-download__cell--album">{task.album}</td>
            <td className="p-download__cell p-download__cell--size">
                {task.totalBytes > 0 ? formatFileSize(task.totalBytes) : '-'}
            </td>
            <td className="p-download__cell p-download__cell--status">
                {isActive ? (
                    <DownloadProgressCell task={task} />
                ) : task.status === 'pending' ? (
                    <span className="p-download__status-text p-download__status-text--pending">
                        {t('download.waiting')}
                    </span>
                ) : task.status === 'error' ? (
                    <span className="p-download__status-text p-download__status-text--error">
                        {t('download.failed')}
                    </span>
                ) : null}
            </td>
            <td className="p-download__cell p-download__cell--actions">
                <TaskActions task={task} />
            </td>
        </tr>
    );
});

// ─── 主组件：任务表格 ───

interface TaskTableProps {
    /** 任务列表 */
    tasks: IDownloadTask[];
}

/**
 * TaskTable — 下载队列表格
 *
 * 混合展示所有未完成任务（pending/downloading/paused/error）。
 */
export function TaskTable({ tasks }: TaskTableProps) {
    const { t } = useTranslation();

    if (tasks.length === 0) {
        return (
            <StatusPlaceholder
                status={RequestStatus.Done}
                isEmpty
                emptyIcon={Download}
                emptyTitle={t('download.empty_queue')}
            />
        );
    }

    return (
        <table className="p-download__table">
            <thead>
                <tr className="p-download__header-row">
                    <th className="p-download__header-cell">{t('download.col_title')}</th>
                    <th className="p-download__header-cell p-download__header-cell--artist">
                        {t('download.col_artist')}
                    </th>
                    <th className="p-download__header-cell p-download__header-cell--album">
                        {t('download.col_album')}
                    </th>
                    <th className="p-download__header-cell p-download__header-cell--size">
                        {t('download.col_size')}
                    </th>
                    <th className="p-download__header-cell p-download__header-cell--status">
                        {t('download.col_status')}
                    </th>
                    <th className="p-download__header-cell p-download__header-cell--actions">
                        {t('download.col_actions')}
                    </th>
                </tr>
            </thead>
            <tbody>
                {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                ))}
            </tbody>
        </table>
    );
}
