import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft } from 'lucide-react';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import pluginManager from '@infra/pluginManager/renderer';
import { usePlugins, usePluginMeta } from '@infra/pluginManager/renderer/hooks';
import { cn } from '@common/cn';
import './index.scss';

interface PluginSourceRedirectModalProps {
    close: () => void;
    plugin: IPlugin.IPluginDelegate;
}

/**
 * PluginSourceRedirectModal — 音源重定向设置弹窗
 *
 * 展示所有支持 getMediaSource 的其他插件列表，
 * 用户可选择一个作为当前插件的音源解析代理，或选择"不重定向"。
 */
export default function PluginSourceRedirectModal({
    close,
    plugin,
}: PluginSourceRedirectModalProps) {
    const { t } = useTranslation();
    const plugins = usePlugins();
    const meta = usePluginMeta();

    const currentRedirect = meta[plugin.hash]?.sourceRedirectPlatform ?? null;
    const [selected, setSelected] = useState<string | null>(currentRedirect);

    // 可选目标：支持 getMediaSource 的其他启用插件
    const candidates = useMemo(
        () =>
            plugins.filter(
                (p) =>
                    p.hash !== plugin.hash &&
                    p.supportedMethod.includes('getMediaSource') &&
                    meta[p.hash]?.enabled !== false,
            ),
        [plugins, plugin.hash, meta],
    );

    const handleSave = useCallback(async () => {
        await pluginManager.setPluginMeta(plugin.hash, {
            sourceRedirectPlatform: selected,
        });
        close();
    }, [plugin.hash, selected, close]);

    const hasChanged = selected !== currentRedirect;

    return (
        <Modal
            open
            onClose={close}
            title={t('plugin.source_redirect_setting')}
            subtitle={t('plugin.source_redirect_description')}
            size="sm"
            footer={
                <div className="plugin-modal__footer-actions">
                    <Button variant="secondary" onClick={close}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={!hasChanged}>
                        {t('common.confirm')}
                    </Button>
                </div>
            }
        >
            <div className="plugin-modal__redirect-list">
                {/* 不重定向选项 */}
                <button
                    type="button"
                    className={cn(
                        'plugin-modal__redirect-item',
                        selected === null && 'is-selected',
                    )}
                    onClick={() => setSelected(null)}
                >
                    <span className="plugin-modal__redirect-item-name">
                        {t('plugin.source_redirect_none')}
                    </span>
                </button>

                {/* 候选插件列表 */}
                {candidates.map((p) => (
                    <button
                        key={p.hash}
                        type="button"
                        className={cn(
                            'plugin-modal__redirect-item',
                            selected === p.platform && 'is-selected',
                        )}
                        onClick={() => setSelected(p.platform)}
                    >
                        <ArrowRightLeft size={14} className="plugin-modal__redirect-item-icon" />
                        <span className="plugin-modal__redirect-item-name">{p.platform}</span>
                        {p.version && (
                            <span className="plugin-modal__redirect-item-version">
                                v{p.version}
                            </span>
                        )}
                    </button>
                ))}

                {/* 无可用插件 */}
                {candidates.length === 0 && (
                    <p className="plugin-modal__muted-text">
                        {t('plugin.source_redirect_no_target')}
                    </p>
                )}
            </div>
        </Modal>
    );
}
