import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Trash2, RotateCw } from 'lucide-react';
import downloadManager from '@infra/downloadManager/renderer';
import { showToast } from '../../../../components/ui/Toast';
import type { IDownloadTask } from '@appTypes/infra/downloadManager';
import './index.scss';

interface TaskActionsProps {
    /** 下载任务 */
    task: IDownloadTask;
}

/**
 * TaskActions — 任务操作按钮组
 *
 * 根据任务状态显示：暂停 / 继续 / 重试 / 删除。
 */
export function TaskActions({ task }: TaskActionsProps) {
    const { t } = useTranslation();

    const handlePause = useCallback(() => {
        downloadManager.pauseTask(task.id);
    }, [task.id]);

    const handleResume = useCallback(() => {
        downloadManager.resumeTask(task.id);
    }, [task.id]);

    const handleRetry = useCallback(() => {
        downloadManager.retryTask(task.id);
    }, [task.id]);

    const handleRemove = useCallback(() => {
        downloadManager.removeTask(task.id);
        showToast(t('download.task_removed'));
    }, [task.id, t]);

    return (
        <div className="p-download__actions">
            {task.status === 'downloading' && (
                <button
                    type="button"
                    className="p-download__action-btn"
                    onClick={handlePause}
                    title={t('download.pause')}
                >
                    <Pause size={16} fill="currentColor" />
                </button>
            )}
            {task.status === 'paused' && (
                <button
                    type="button"
                    className="p-download__action-btn"
                    onClick={handleResume}
                    title={t('download.resume')}
                >
                    <Play size={16} fill="currentColor" />
                </button>
            )}
            {task.status === 'error' && (
                <button
                    type="button"
                    className="p-download__action-btn"
                    onClick={handleRetry}
                    title={t('download.retry')}
                >
                    <RotateCw size={16} />
                </button>
            )}
            <button
                type="button"
                className="p-download__action-btn p-download__action-btn--danger"
                onClick={handleRemove}
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
}
