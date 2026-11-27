import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import playlistManager from '@infra/playlist/renderer';
import './index.scss';

/** 歌单名称最大长度 */
const PLAYLIST_NAME_MAX_LENGTH = 120;

export interface RenamePlaylistModalProps {
    close: () => void;
    /** 歌单 ID */
    sheetId: string;
    /** 当前歌单名称（用于回显） */
    currentTitle: string;
}

/**
 * RenameSheetModal — 重命名歌单弹窗（业务组件）
 */
export default function RenamePlaylistModal({
    close,
    sheetId: playlistId,
    currentTitle,
}: RenamePlaylistModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState(currentTitle);
    const [loading, setLoading] = useState(false);
    const submittingRef = useRef(false);

    const trimmedName = name.trim();
    const canSubmit = trimmedName.length > 0 && trimmedName !== currentTitle && !loading;

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || submittingRef.current) return;
        submittingRef.current = true;

        setLoading(true);
        try {
            await playlistManager.updatePlaylist(playlistId, { title: trimmedName });
            close();
        } catch {
            showToast(t('playlist.rename_failed'));
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    }, [canSubmit, playlistId, trimmedName, close, t]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
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
            title={t('playlist.rename_sheet')}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={loading}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        loading={loading}
                    >
                        {t('common.confirm')}
                    </Button>
                </>
            }
        >
            <Input
                value={name}
                className="rename-sheet-modal__input"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={PLAYLIST_NAME_MAX_LENGTH}
                placeholder={t('playlist.rename_sheet')}
                autoFocus
            />
        </Modal>
    );
}
