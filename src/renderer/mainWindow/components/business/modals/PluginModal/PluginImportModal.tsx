import { useCallback, useState } from 'react';
import { Link2, ListPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import pluginManager from '@infra/pluginManager/renderer';
import './index.scss';

type ImportType = 'importMusicItem' | 'importMusicSheet';

interface PluginImportModalProps {
    close: () => void;
    plugin: IPlugin.IPluginDelegate;
    type: ImportType;
}

/**
 * PluginImportModal — 导入单曲/歌单弹窗
 *
 * 单步流程：输入 URL → 加载 → 成功后链式打开 AddMusicToSheetModal
 */
export default function PluginImportModal({ close, plugin, type }: PluginImportModalProps) {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);

    const isTrack = type === 'importMusicItem';
    const title = isTrack
        ? `${t('plugin.method_import_music_item')} · ${plugin.platform}`
        : `${t('plugin.method_import_music_sheet')} · ${plugin.platform}`;
    const placeholder = isTrack
        ? t('plugin.placeholder_import_music_item', { plugin: plugin.platform })
        : t('plugin.placeholder_import_music_sheet', { plugin: plugin.platform });

    const handleConfirm = useCallback(async () => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        setLoading(true);
        try {
            const result = await pluginManager.callPluginMethod({
                hash: plugin.hash,
                method: type,
                args: [trimmed],
            });

            if (result) {
                const items = Array.isArray(result) ? result : [result];
                if (items.length === 0) {
                    showToast(t('plugin.import_empty_result'), { type: 'warn' });
                    return;
                }
                close();
                showModal('AddMusicToSheetModal', { musicItems: items });
            } else {
                showToast(t('plugin.import_invalid_link'), { type: 'warn' });
            }
        } catch (e: any) {
            showToast(t('plugin.import_error', { reason: e?.message ?? '' }), {
                type: 'warn',
            });
        } finally {
            setLoading(false);
        }
    }, [inputValue, plugin.hash, type, close, t]);

    // ── hints ──
    const hints = plugin.hints?.[type];

    return (
        <Modal
            open
            onClose={close}
            title={title}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={loading}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        loading={loading}
                        disabled={!inputValue.trim()}
                    >
                        {t('common.confirm')}
                    </Button>
                </>
            }
        >
            <div className="plugin-modal__import">
                <Input
                    prefix={isTrack ? <Link2 size={16} /> : <ListPlus size={16} />}
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={loading}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirm();
                    }}
                />
                {hints && hints.length > 0 && (
                    <div className="plugin-modal__hints">
                        {hints.map((hint, i) => (
                            <p key={i} className="plugin-modal__hint-item">
                                {hint}
                            </p>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}
