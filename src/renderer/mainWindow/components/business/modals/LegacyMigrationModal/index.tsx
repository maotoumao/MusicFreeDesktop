/**
 * LegacyMigrationModal — 旧版数据迁移确认弹窗（业务组件）
 *
 * 检测到旧版 IndexedDB 数据后弹出，展示歌单/歌曲数量，
 * 让用户选择是否导入。无论用户选择「导入」或「跳过」，
 * 均标记迁移完成，不再重复提示。
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { ProgressBar } from '@renderer/mainWindow/components/ui/ProgressBar';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { syncKV } from '@renderer/common/kvStore';
import {
    executeMigration,
    type LegacyDetectResult,
} from '@renderer/mainWindow/core/legacyMigration';
import './index.scss';

type MigrationState = 'idle' | 'migrating';

export interface LegacyMigrationModalProps {
    close: () => void;
    /** 检测到的旧版数据概要 */
    detectResult: LegacyDetectResult;
}

export default function LegacyMigrationModal({ close, detectResult }: LegacyMigrationModalProps) {
    const { t } = useTranslation();
    const [state, setState] = useState<MigrationState>('idle');

    const markCompleted = useCallback(() => {
        syncKV.set('migration.v1Completed', true);
    }, []);

    const handleSkip = useCallback(() => {
        markCompleted();
        close();
    }, [markCompleted, close]);

    const handleMigrate = useCallback(async () => {
        setState('migrating');
        const result = await executeMigration();
        markCompleted();

        if (result.success) {
            showToast(
                t('migration.success', {
                    sheets: result.sheetsImported,
                    songs: result.songsImported,
                }),
            );
        } else {
            showToast(t('migration.fail', { reason: result.error ?? '' }), { type: 'warn' });
        }

        close();
    }, [markCompleted, close, t]);

    const isMigrating = state === 'migrating';

    return (
        <Modal
            open
            onClose={handleSkip}
            title={t('migration.title')}
            size="sm"
            closable={!isMigrating}
            closeOnBackdrop={!isMigrating}
            closeOnEscape={!isMigrating}
            footer={
                isMigrating ? undefined : (
                    <>
                        <Button variant="secondary" onClick={handleSkip}>
                            {t('migration.skip')}
                        </Button>
                        <Button variant="primary" onClick={handleMigrate}>
                            {t('migration.import')}
                        </Button>
                    </>
                )
            }
        >
            {isMigrating ? (
                <div className="legacy-migration-modal__progress">
                    <ProgressBar variant="thick" interactive={false} />
                    <p className="legacy-migration-modal__text">{t('migration.migrating')}</p>
                </div>
            ) : (
                <div className="legacy-migration-modal__body">
                    <p className="legacy-migration-modal__message">
                        {t('migration.detected', {
                            sheets: detectResult.sheetCount,
                            songs: detectResult.songCount,
                        })}
                    </p>
                    <p className="legacy-migration-modal__hint">{t('migration.hint')}</p>
                </div>
            )}
        </Modal>
    );
}
