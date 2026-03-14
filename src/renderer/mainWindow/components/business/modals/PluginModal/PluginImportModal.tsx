import { useCallback, useState, useMemo } from 'react';
import { Link2, ListPlus, Heart, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import pluginManager from '@infra/pluginManager/renderer';
import musicSheet from '@infra/musicSheet/renderer';
import { DEFAULT_FAVORITE_SHEET_ID } from '@infra/musicSheet/common/constant';
import './index.scss';

type ImportType = 'importMusicItem' | 'importMusicSheet';
type Step = 'input' | 'select-sheet';

interface PluginImportModalProps {
    close: () => void;
    plugin: IPlugin.IPluginDelegate;
    type: ImportType;
}

/**
 * PluginImportModal — 导入单曲/歌单弹窗
 *
 * 两步流程（仅单曲导入）：
 *   1. 输入 URL → 加载
 *   2. 选择目标歌单 → 完成
 * 歌单导入一步完成。
 */
export default function PluginImportModal({ close, plugin, type }: PluginImportModalProps) {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<Step>('input');
    const [importedItems, setImportedItems] = useState<IMusic.IMusicItem[]>([]);

    const isTrack = type === 'importMusicItem';
    const title = isTrack
        ? `${t('plugin.method_import_music_item')} · ${plugin.platform}`
        : `${t('plugin.method_import_music_sheet')} · ${plugin.platform}`;
    const placeholder = isTrack
        ? t('plugin.placeholder_import_music_item', { plugin: plugin.platform })
        : t('plugin.placeholder_import_music_sheet', { plugin: plugin.platform });

    // 获取所有歌单列表（在第二步使用）
    const sheets = useMemo(() => musicSheet.getAllSheets(), []);

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
                if (isTrack) {
                    // 单曲导入成功：进入歌单选择步骤
                    const items = Array.isArray(result) ? result : [result];
                    setImportedItems(items);
                    setStep('select-sheet');
                } else {
                    // 歌单导入成功
                    showToast(t('plugin.import_sheet_success'));
                    close();
                }
            } else {
                showToast(t('plugin.import_failed'), { type: 'warn' });
            }
        } catch (e: any) {
            showToast(`${t('plugin.import_failed')}: ${e?.message ?? ''}`, {
                type: 'warn',
            });
        } finally {
            setLoading(false);
        }
    }, [inputValue, plugin.hash, type, isTrack, close, t]);

    // ── 选择歌单后添加 ──
    const handleSelectSheet = useCallback(
        (sheetId: string, sheetName: string) => {
            try {
                musicSheet.addMusicToSheet(importedItems, sheetId);
                showToast(
                    t('plugin.import_to_sheet_success', {
                        count: importedItems.length,
                        sheet: sheetName,
                    }),
                );
            } catch {
                showToast(t('plugin.import_failed'), { type: 'warn' });
            }
            close();
        },
        [importedItems, close, t],
    );

    // ── hints ──
    const hints = plugin.hints?.[type];

    // 第一步：输入 URL
    if (step === 'input') {
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

    // 第二步：选择目标歌单
    return (
        <Modal
            open
            onClose={close}
            title={t('plugin.select_target_sheet')}
            subtitle={t('plugin.import_music_success', {
                count: importedItems.length,
            })}
            size="md"
        >
            <div className="plugin-modal__sheet-list">
                {/* 收藏歌单始终排第一 */}
                <button
                    type="button"
                    className="plugin-modal__sheet-item"
                    onClick={() =>
                        handleSelectSheet(
                            DEFAULT_FAVORITE_SHEET_ID,
                            t('media.default_favorite_sheet_name'),
                        )
                    }
                >
                    <Heart size={16} />
                    <span>{t('media.default_favorite_sheet_name')}</span>
                </button>
                {sheets
                    .filter((s) => s.id !== DEFAULT_FAVORITE_SHEET_ID)
                    .map((sheet) => (
                        <button
                            key={sheet.id}
                            type="button"
                            className="plugin-modal__sheet-item"
                            onClick={() => handleSelectSheet(sheet.id, sheet.title)}
                        >
                            <List size={16} />
                            <span>{sheet.title}</span>
                        </button>
                    ))}
            </div>
        </Modal>
    );
}
