import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import musicSheet from '@infra/musicSheet/renderer';
import './index.scss';

/** 歌单名称最大长度 */
const SHEET_NAME_MAX_LENGTH = 120;

export interface CreateSheetModalProps {
    close: () => void;
    /** 创建后自动添加到新歌单的歌曲（可选） */
    initMusicItems?: IMusic.IMusicItem[];
}

/**
 * CreateSheetModal — 新建歌单弹窗（业务组件）
 */
export default function CreateSheetModal({ close, initMusicItems }: CreateSheetModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const submittingRef = useRef(false);

    const trimmedName = name.trim();
    const canSubmit = trimmedName.length > 0 && !loading;

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || submittingRef.current) return;
        submittingRef.current = true;

        setLoading(true);
        try {
            const sheet = await musicSheet.addSheet(trimmedName);

            if (initMusicItems?.length) {
                musicSheet.addMusicToSheet(initMusicItems, sheet.id);
            }

            close();
        } catch {
            showToast(t('playlist.create_failed'));
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    }, [canSubmit, trimmedName, initMusicItems, close, t]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    return (
        <Modal
            open
            onClose={close}
            closeOnEscape={!loading}
            closeOnBackdrop={!loading}
            title={t('playlist.create_sheet')}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={loading}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={loading}
                        disabled={!canSubmit}
                    >
                        {t('common.create')}
                    </Button>
                </>
            }
        >
            <Input
                className="create-sheet-modal__input"
                autoFocus
                placeholder={t('playlist.create_placeholder')}
                maxLength={SHEET_NAME_MAX_LENGTH}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                allowClear
                onClear={() => setName('')}
            />
        </Modal>
    );
}
