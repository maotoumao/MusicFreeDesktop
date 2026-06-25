import { useCallback, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, CircleCheckBig, LoaderCircle, CircleAlert } from 'lucide-react';
import { cn } from '@common/cn';
import { LOCAL_PLUGIN_NAME } from '@common/constant';
import downloadManager, {
    useMusicDownloaded,
    useMusicDownloadTask,
} from '@infra/downloadManager/renderer';
import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
import './index.scss';

/** DownloadButton 尺寸预设 */
export type DownloadButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DownloadButtonProps extends Omit<
    HTMLAttributes<HTMLButtonElement>,
    'onClick' | 'children'
> {
    /** 歌曲数据（完整或精简均可） */
    musicItem: IMusic.IMusicItem | IMusicItemSlim;
    /** 图标尺寸 */
    size?: DownloadButtonSize;
}

/**
 * DownloadButton — 业务组件
 *
 * 下载按钮，根据歌曲下载状态切换图标。
 * - 未下载：显示下载图标，点击触发下载
 * - 下载中：显示旋转加载图标
 * - 下载失败：显示错误图标，点击重试
 * - 已下载 / 本地歌曲：显示对勾图标，禁用点击
 *
 * 设计稿还原（像素级）：
 *   容器: inline-flex, items-center, justify-center, rounded-pill
 *   默认: bg transparent, color text-secondary
 *   hover: bg fill-subtle-hover, color text-primary
 *   已下载: color status-success-text, opacity disabled, cursor default
 *   下载中: color text-brand, icon spin
 *   下载失败: color status-danger-text, hover 可点击重试
 *   active: opacity 0.6
 *   尺寸: sm(--icon-sm) md(--icon-md) lg(--icon-lg) xl(--icon-xl)
 */
export function DownloadButton({
    musicItem,
    size = 'lg',
    className,
    ...rest
}: DownloadButtonProps) {
    const { t } = useTranslation();
    const isLocal = musicItem.platform === LOCAL_PLUGIN_NAME;
    const downloaded = useMusicDownloaded(musicItem);
    const taskStatus = useMusicDownloadTask(musicItem);
    const isError = taskStatus === 'error';
    const isDownloading =
        taskStatus === 'pending' || taskStatus === 'downloading' || taskStatus === 'paused';
    const isCompleted = !isError && !isDownloading && (isLocal || downloaded !== null);
    const isInactive = isCompleted || isDownloading;
    const lockRef = useRef(false);

    const handleClick = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (isInactive || lockRef.current) return;
            lockRef.current = true;

            try {
                if (isError) {
                    await downloadManager.retryByMusicItem(musicItem);
                } else {
                    await downloadManager.addTask({ musicItem });
                }
            } catch (e) {
                console.error('[DownloadButton] download failed:', e);
            } finally {
                lockRef.current = false;
            }
        },
        [isInactive, isError, musicItem],
    );

    let ariaLabel: string;
    let icon: ReactNode;

    if (isCompleted) {
        ariaLabel = t('common.downloaded');
        icon = <CircleCheckBig size="100%" />;
    } else if (isDownloading) {
        ariaLabel = t('common.downloading');
        icon = <LoaderCircle size="100%" />;
    } else if (isError) {
        ariaLabel = t('download.failed_retry');
        icon = <CircleAlert size="100%" />;
    } else {
        ariaLabel = t('common.download');
        icon = <Download size="100%" />;
    }

    return (
        <button
            type="button"
            className={cn(
                'download-btn',
                `download-btn--${size}`,
                isCompleted && 'is-completed',
                isDownloading && 'is-downloading',
                isError && 'is-error',
                className,
            )}
            disabled={isInactive}
            aria-label={ariaLabel}
            onClick={handleClick}
            onDoubleClick={(e) => e.stopPropagation()}
            {...rest}
        >
            {icon}
        </button>
    );
}

export default DownloadButton;
