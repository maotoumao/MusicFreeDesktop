import { useState, useCallback, useRef } from 'react';
import { Upload, Link2, Music } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import pluginManager from '@infra/pluginManager/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import fsUtil from '@infra/fsUtil/renderer';
import { cn } from '@common/cn';
import './index.scss';

interface PluginInstallModalProps {
    close: () => void;
}

/**
 * PluginInstallModal — 安装插件弹窗
 *
 * 两个 Tab：本地安装 / 网络链接
 * 设计稿方案：单弹窗 + Tab 切换
 */
export default function PluginInstallModal({ close }: PluginInstallModalProps) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<'local' | 'url'>('url');
    const [url, setUrl] = useState('');
    const [installing, setInstalling] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    // ── 通过文件路径安装（复用于选择和拖拽） ──
    const installFromPath = useCallback(
        async (filePath: string) => {
            setInstalling(true);
            try {
                const installResult = await pluginManager.installPlugin(filePath);
                if (installResult.success) {
                    showToast(t('plugin.install_successfully'));
                    close();
                } else {
                    showToast(
                        `${t('plugin.install_failed')}: ${installResult.message ?? t('plugin.invalid_plugin')}`,
                        { type: 'warn' },
                    );
                }
            } catch (e: any) {
                showToast(
                    `${t('plugin.install_failed')}: ${e?.message ?? t('plugin.invalid_plugin')}`,
                    { type: 'warn' },
                );
            } finally {
                setInstalling(false);
            }
        },
        [close, t],
    );

    // ── 本地安装（文件选择器） ──
    const handleLocalInstall = useCallback(async () => {
        try {
            const result = await systemUtil.showOpenDialog({
                title: t('plugin.choose_plugin'),
                buttonLabel: t('plugin.install'),
                filters: [
                    {
                        extensions: ['js', 'json'],
                        name: t('plugin.musicfree_plugin'),
                    },
                ],
                properties: ['openFile'],
            });
            if (result.canceled || !result.filePaths.length) return;
            await installFromPath(result.filePaths[0]);
        } catch (e: any) {
            showToast(
                `${t('plugin.install_failed')}: ${e?.message ?? t('plugin.invalid_plugin')}`,
                { type: 'warn' },
            );
        }
    }, [installFromPath, t]);

    // ── 拖拽事件处理 ──
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current = 0;
            setIsDragOver(false);

            const files = Array.from(e.dataTransfer.files);

            const validMimeTypes = [
                'text/javascript',
                'application/javascript',
                'application/x-javascript',
                'application/json',
            ];
            const pluginFile = files.find((f) => validMimeTypes.includes(f.type));
            if (!pluginFile) {
                showToast(t('plugin.error_hint_plugin_should_end_with_js_or_json'), {
                    type: 'warn',
                });
                return;
            }
            const realPath = fsUtil.getPathForFile(pluginFile);
            await installFromPath(realPath);
        },
        [installFromPath, t],
    );

    // ── 网络安装 ──
    const handleUrlInstall = useCallback(async () => {
        const trimmed = url.trim();
        try {
            const { pathname } = new URL(trimmed);
            if (!pathname.endsWith('.js') && !pathname.endsWith('.json')) {
                showToast(t('plugin.error_hint_plugin_should_end_with_js_or_json'), {
                    type: 'warn',
                });
                return;
            }
        } catch {
            showToast(t('plugin.error_hint_plugin_should_end_with_js_or_json'), {
                type: 'warn',
            });
            return;
        }

        setInstalling(true);
        try {
            const result = await pluginManager.installPlugin(trimmed);
            if (result.success) {
                showToast(t('plugin.install_successfully'));
                close();
            } else {
                showToast(
                    `${t('plugin.install_failed')}: ${result.message ?? t('plugin.invalid_plugin')}`,
                    { type: 'warn' },
                );
            }
        } catch (e: any) {
            showToast(
                `${t('plugin.install_failed')}: ${e?.message ?? t('plugin.invalid_plugin')}`,
                { type: 'warn' },
            );
        } finally {
            setInstalling(false);
        }
    }, [url, close, t]);

    return (
        <Modal
            open
            onClose={close}
            title={t('plugin.install_plugin')}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={installing}>
                        {t('common.cancel')}
                    </Button>
                    {tab === 'url' && (
                        <Button
                            variant="primary"
                            onClick={handleUrlInstall}
                            loading={installing}
                            disabled={!url.trim()}
                        >
                            {t('plugin.install')}
                        </Button>
                    )}
                </>
            }
        >
            {/* Tab 切换 */}
            <div className="plugin-modal__tabs">
                <button
                    type="button"
                    className={cn('plugin-modal__tab', tab === 'url' && 'is-active')}
                    onClick={() => setTab('url')}
                >
                    {t('plugin.network_install')}
                </button>
                <button
                    type="button"
                    className={cn('plugin-modal__tab', tab === 'local' && 'is-active')}
                    onClick={() => setTab('local')}
                >
                    {t('plugin.local_install')}
                </button>
            </div>

            {/* 网络安装 */}
            {tab === 'url' && (
                <div className="plugin-modal__url">
                    <Input
                        prefix={<Link2 size={16} />}
                        placeholder={t('plugin.paste_plugin_url')}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={installing}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUrlInstall();
                        }}
                    />
                    <p className="plugin-modal__hint">
                        <Music size={14} />
                        {t('plugin.supported_url_hint')}
                    </p>
                </div>
            )}

            {/* 本地安装 */}
            {tab === 'local' && (
                <div className="plugin-modal__local">
                    <button
                        type="button"
                        className={cn('plugin-modal__dropzone', isDragOver && 'is-drag-over')}
                        onClick={handleLocalInstall}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        disabled={installing}
                    >
                        <Upload size={24} className="plugin-modal__dropzone-icon" />
                        <span className="plugin-modal__dropzone-text">
                            {t('plugin.drag_or_select_file')}
                        </span>
                    </button>
                    <p className="plugin-modal__hint">
                        <Music size={14} />
                        {t('plugin.supported_formats')}
                    </p>
                </div>
            )}
        </Modal>
    );
}
