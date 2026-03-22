import { useState, useCallback } from 'react';
import { Download, Palette, Loader2 } from 'lucide-react';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { A } from '@renderer/mainWindow/components/ui/A';
import './index.scss';

export interface ThemeDetailModalProps {
    close: () => void;
    /** 主题名称 */
    name: string;
    /** 主题作者 */
    author?: string;
    /** 作者主页 URL */
    authorUrl?: string;
    /** 主题描述 */
    description?: string;
    /** 主题版本号 */
    version?: string;
    /** 预览图 URL 或 #hex 纯色 */
    preview?: string;
    /** 安装/使用回调 */
    onInstall: () => void | Promise<void>;
    /** 安装按钮文案 */
    installLabel: string;
    /** 是否需要下载（影响主按钮图标） */
    needsDownload?: boolean;
    /** 仅下载回调（可选，提供时显示仅下载按钮） */
    onDownloadOnly?: () => void | Promise<void>;
    /** 仅下载按钮文案 */
    downloadOnlyLabel?: string;
}

/**
 * ThemeDetailModal — 远程主题详情弹窗（业务组件）
 *
 * 展示远程主题的大图预览和详细信息，提供安装操作。
 */
export default function ThemeDetailModal({
    close,
    name,
    author,
    authorUrl,
    description,
    version,
    preview,
    onInstall,
    installLabel,
    needsDownload = false,
    onDownloadOnly,
    downloadOnlyLabel,
}: ThemeDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [downloadOnlyLoading, setDownloadOnlyLoading] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);

    const handleInstall = useCallback(async () => {
        setLoading(true);
        try {
            await onInstall();
            close();
        } catch {
            // 错误提示由 onInstall 内部处理
        } finally {
            setLoading(false);
        }
    }, [onInstall, close]);

    const handleDownloadOnly = useCallback(async () => {
        if (!onDownloadOnly) return;
        setDownloadOnlyLoading(true);
        try {
            await onDownloadOnly();
            close();
        } catch {
            // 错误提示由 onDownloadOnly 内部处理
        } finally {
            setDownloadOnlyLoading(false);
        }
    }, [onDownloadOnly, close]);

    return (
        <Modal
            open
            onClose={close}
            title={name}
            subtitle={
                author || version ? (
                    <>
                        {author && (authorUrl ? <A href={authorUrl}>{author}</A> : author)}
                        {author && version && ' · '}
                        {version && `v${version}`}
                    </>
                ) : undefined
            }
            size="md"
            footer={
                <>
                    {onDownloadOnly && downloadOnlyLabel && (
                        <Button
                            variant="secondary"
                            onClick={handleDownloadOnly}
                            loading={downloadOnlyLoading}
                            disabled={loading}
                            icon={<Download width={16} height={16} />}
                        >
                            {downloadOnlyLabel}
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        onClick={handleInstall}
                        loading={loading}
                        disabled={downloadOnlyLoading}
                        icon={
                            needsDownload ? (
                                <Download width={16} height={16} />
                            ) : (
                                <Palette width={16} height={16} />
                            )
                        }
                    >
                        {installLabel}
                    </Button>
                </>
            }
        >
            <div className="theme-detail-modal">
                <div className="theme-detail-modal__preview">
                    {preview?.startsWith('#') ? (
                        <div
                            className="theme-detail-modal__preview-color"
                            style={{ backgroundColor: preview }}
                        />
                    ) : preview ? (
                        <>
                            <div
                                className="theme-detail-modal__preview-loading"
                                style={{ opacity: imgLoaded ? 0 : 1, pointerEvents: 'none' }}
                            >
                                <Loader2 className="theme-detail-modal__spinner" />
                            </div>
                            <img
                                className="theme-detail-modal__preview-img"
                                src={preview}
                                alt={name}
                                onLoad={() => setImgLoaded(true)}
                            />
                        </>
                    ) : (
                        <div className="theme-detail-modal__preview-color theme-detail-modal__preview-color--fallback" />
                    )}
                </div>
                {description && <p className="theme-detail-modal__description">{description}</p>}
            </div>
        </Modal>
    );
}
