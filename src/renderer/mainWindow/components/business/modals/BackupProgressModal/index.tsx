/**
 * BackupProgressModal — 备份/恢复进度弹窗（业务组件）
 *
 * 不可关闭，阻止用户操作。通过 IPC 进度事件更新展示。
 * 操作完成后由调用方关闭。
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { ProgressBar } from '@renderer/mainWindow/components/ui/ProgressBar';
import backup from '@infra/backup/renderer';
import type { IBackupProgress } from '@appTypes/infra/backup';
import './index.scss';

export interface BackupProgressModalProps {
    close: () => void;
    /** 操作类型 */
    action: 'backup' | 'restore';
}

export default function BackupProgressModal({ action }: BackupProgressModalProps) {
    const { t } = useTranslation();
    const [current, setCurrent] = useState(0);
    const [total, setTotal] = useState(0);
    const [sheetTitle, setSheetTitle] = useState('');

    useEffect(() => {
        const unsubscribe = backup.onProgress((progress: IBackupProgress) => {
            setCurrent(progress.current);
            setTotal(progress.total);
            if (progress.sheetTitle) {
                setSheetTitle(progress.sheetTitle);
            }
        });
        return unsubscribe;
    }, []);

    const title =
        action === 'backup'
            ? t('settings.backup.backup_music_sheet')
            : t('settings.backup.resume_music_sheet');

    const progressText =
        total > 0
            ? `${current} / ${total}${sheetTitle ? ` — ${sheetTitle}` : ''}`
            : t('common.loading');

    const progressValue = total > 0 ? (current / total) * 100 : 0;

    return (
        <Modal
            open
            onClose={() => {}}
            title={title}
            size="sm"
            closable={false}
            closeOnBackdrop={false}
            closeOnEscape={false}
        >
            <div className="backup-progress-modal">
                <ProgressBar value={progressValue} variant="thick" interactive={false} />
                <p className="backup-progress-modal__text">{progressText}</p>
            </div>
        </Modal>
    );
}
