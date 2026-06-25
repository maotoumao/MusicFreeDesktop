import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import formatFileSize from '@common/formatFileSize';
import { useDownloadProgress } from '@infra/downloadManager/renderer';
import type { IDownloadTask, IDownloadProgress } from '@appTypes/infra/downloadManager';
import './index.scss';

/** 根据任务和实时进度计算显示信息 */
function getDisplayProgress(
    task: IDownloadTask,
    progress: IDownloadProgress | undefined,
): { percent: number; speed: string } {
    const totalBytes = progress?.totalBytes || task.totalBytes;
    const downloadedBytes = progress?.downloadedBytes || task.downloadedBytes;
    const percent =
        totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
    const speed = progress?.speed ? formatFileSize(progress.speed) + '/s' : '';
    return { percent, speed };
}

interface DownloadProgressCellProps {
    /** 下载任务 */
    task: IDownloadTask;
}

/**
 * DownloadProgressCell — 下载进度单元格
 *
 * 显示进度条 + 百分比 + 速度文本。
 */
export function DownloadProgressCell({ task }: DownloadProgressCellProps) {
    const { t } = useTranslation();
    const progress = useDownloadProgress(task.id);
    const isPaused = task.status === 'paused';
    const displayProgress = getDisplayProgress(task, progress);

    return (
        <div className="p-download__progress-cell">
            <div className="p-download__progress-track">
                <div
                    className={cn(
                        'p-download__progress-fill',
                        isPaused && 'p-download__progress-fill--paused',
                    )}
                    style={{ width: `${displayProgress.percent}%` }}
                />
            </div>
            <span className="p-download__progress-text">
                {displayProgress.percent}%
                {isPaused
                    ? ` · ${t('download.paused')}`
                    : displayProgress.speed
                      ? ` · ${displayProgress.speed}`
                      : ''}
            </span>
        </div>
    );
}
