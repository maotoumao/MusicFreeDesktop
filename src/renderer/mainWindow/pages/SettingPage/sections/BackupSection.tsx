import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { RadioGroup } from '@renderer/mainWindow/components/ui/RadioGroup';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { Select } from '@renderer/mainWindow/components/ui/Select';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import { useBufferedConfigInput } from '../hooks/useBufferedConfigInput';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { showModal, closeModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import backup from '@infra/backup/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import type { RestoreMode, IBackupResult } from '@appTypes/infra/backup';

/**
 * 备份与恢复设置
 *
 * 配置项：backup.resumeBehavior、backup.webdav.*
 */
export function BackupSection() {
    const { t } = useTranslation();
    const [resumeBehavior, setResumeBehavior] = useConfigValue('backup.resumeBehavior');

    const webdavUrl = useBufferedConfigInput('backup.webdav.url');
    const webdavUsername = useBufferedConfigInput('backup.webdav.username');
    const webdavPassword = useBufferedConfigInput('backup.webdav.password');

    const [backupMode, setBackupMode] = useState<'file' | 'webdav'>('file');
    const [operating, setOperating] = useState(false);

    /** 统一处理恢复结果 */
    const handleRestoreResult = useCallback(
        (result: IBackupResult) => {
            closeModal('BackupProgressModal');
            if (result.success) {
                showToast(t('settings.backup.resume_success'), { type: 'info' });
            } else if (result.error) {
                showToast(
                    t('settings.backup.resume_fail', {
                        reason: t(`settings.backup.${result.error}`, result.error),
                    }),
                    { type: 'warn' },
                );
            }
        },
        [t],
    );

    /** 执行恢复操作（文件/WebDAV 共用） */
    const executeRestore = useCallback(
        async (restoreFn: (mode: RestoreMode) => Promise<IBackupResult>) => {
            const mode = (resumeBehavior ?? 'append') as RestoreMode;

            const doRestore = async () => {
                setOperating(true);
                showModal('BackupProgressModal', { action: 'restore' });
                try {
                    const result = await restoreFn(mode);
                    handleRestoreResult(result);
                } catch (e) {
                    closeModal('BackupProgressModal');
                    showToast(
                        t('settings.backup.resume_fail', {
                            reason: e instanceof Error ? e.message : String(e),
                        }),
                        { type: 'warn' },
                    );
                } finally {
                    setOperating(false);
                }
            };

            if (mode === 'overwrite') {
                showModal('ConfirmModal', {
                    title: t('settings.backup.resume_music_sheet'),
                    message: t('settings.backup.overwrite_confirm'),
                    confirmDanger: true,
                    onConfirm: doRestore,
                });
            } else {
                await doRestore();
            }
        },
        [resumeBehavior, handleRestoreResult, t],
    );

    // ─── 文件备份 ───

    const handleBackupToFile = useCallback(async () => {
        const dialogResult = await systemUtil.showSaveDialog({
            title: t('settings.backup.backup_music_sheet'),
            defaultPath: `MusicFreeBackup_${formatDate()}.json`,
            filters: [
                {
                    name: t('settings.backup.musicfree_backup_file'),
                    extensions: ['json'],
                },
            ],
        });
        if (dialogResult.canceled || !dialogResult.filePath) return;

        setOperating(true);
        try {
            const result = await backup.backupToFile(dialogResult.filePath);
            if (result.success) {
                showToast(t('settings.backup.backup_success'), { type: 'info' });
            } else if (result.error) {
                showToast(t('settings.backup.backup_fail', { reason: result.error }), {
                    type: 'warn',
                });
            }
        } catch (e) {
            showToast(
                t('settings.backup.backup_fail', {
                    reason: e instanceof Error ? e.message : String(e),
                }),
                { type: 'warn' },
            );
        } finally {
            setOperating(false);
        }
    }, [t]);

    const handleRestoreFromFile = useCallback(async () => {
        const dialogResult = await systemUtil.showOpenDialog({
            title: t('settings.backup.resume_music_sheet'),
            filters: [
                {
                    name: t('settings.backup.musicfree_backup_file'),
                    extensions: ['json'],
                },
            ],
            properties: ['openFile'],
        });
        if (dialogResult.canceled || !dialogResult.filePaths[0]) return;

        const filePath = dialogResult.filePaths[0];
        return executeRestore((mode) => backup.restoreFromFile(filePath, mode));
    }, [executeRestore, t]);

    // ─── WebDAV ───

    const handleTestWebdav = useCallback(async () => {
        setOperating(true);
        try {
            const result = await backup.testWebDAV();
            if (result.success) {
                showToast(t('settings.backup.webdav_connect_success'), { type: 'info' });
            } else {
                showToast(t('settings.backup.webdav_connect_fail'), {
                    type: 'warn',
                    description: result.error,
                });
            }
        } catch {
            showToast(t('settings.backup.webdav_connect_fail'), { type: 'warn' });
        } finally {
            setOperating(false);
        }
    }, [t]);

    const handleBackupToWebDAV = useCallback(async () => {
        setOperating(true);
        try {
            const result = await backup.backupToWebDAV();
            if (result.success) {
                showToast(t('settings.backup.backup_success'), { type: 'info' });
            } else if (result.error) {
                showToast(
                    t('settings.backup.backup_fail', {
                        reason: t(`settings.backup.${result.error}`, result.error),
                    }),
                    { type: 'warn' },
                );
            }
        } catch (e) {
            showToast(
                t('settings.backup.backup_fail', {
                    reason: e instanceof Error ? e.message : String(e),
                }),
                { type: 'warn' },
            );
        } finally {
            setOperating(false);
        }
    }, [t]);

    const handleRestoreFromWebDAV = useCallback(() => {
        return executeRestore(backup.restoreFromWebDAV);
    }, [executeRestore]);

    return (
        <SettingsCard
            title={t('settings.section_name.backup')}
            subtitle={t('settings.backup.backup_by_file')}
        >
            <SettingRow
                label={t('settings.backup.resume_mode_label')}
                description={t('settings.backup.resume_mode_desc')}
                control={
                    <Select
                        value={resumeBehavior ?? 'append'}
                        onChange={setResumeBehavior}
                        options={[
                            {
                                value: 'append',
                                label: t('settings.backup.resume_mode_append'),
                            },
                            {
                                value: 'overwrite',
                                label: t('settings.backup.resume_mode_overwrite'),
                            },
                        ]}
                    />
                }
            />
            <SettingRow
                label={t('settings.backup.backup_mode_label')}
                description={t('settings.backup.backup_mode_desc')}
                control={
                    <RadioGroup
                        value={backupMode}
                        onChange={(val) => setBackupMode(val as 'file' | 'webdav')}
                        options={[
                            {
                                value: 'file',
                                label: t('settings.backup.backup_by_file'),
                            },
                            {
                                value: 'webdav',
                                label: t('settings.backup.backup_by_webdav'),
                            },
                        ]}
                    />
                }
            />

            {backupMode === 'file' ? (
                <div className="p-setting__action-row">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleBackupToFile}
                        disabled={operating}
                    >
                        {t('settings.backup.backup_to')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleRestoreFromFile}
                        disabled={operating}
                    >
                        {t('settings.backup.resume_music_sheet')}
                    </Button>
                </div>
            ) : (
                <>
                    <SettingRow
                        label={t('settings.backup.webdav_server_url')}
                        description="https://dav.example.com"
                        control={
                            <Input
                                value={webdavUrl.localValue}
                                onChange={webdavUrl.handleChange}
                                onBlur={webdavUrl.handleBlur}
                                placeholder="https://dav.example.com"
                            />
                        }
                    />
                    <SettingRow
                        label={t('settings.backup.username')}
                        control={
                            <Input
                                value={webdavUsername.localValue}
                                onChange={webdavUsername.handleChange}
                                onBlur={webdavUsername.handleBlur}
                                placeholder={t('settings.backup.username')}
                            />
                        }
                    />
                    <SettingRow
                        label={t('settings.backup.password')}
                        control={
                            <Input
                                value={webdavPassword.localValue}
                                onChange={webdavPassword.handleChange}
                                onBlur={webdavPassword.handleBlur}
                                placeholder={t('settings.backup.password')}
                                type="password"
                            />
                        }
                    />
                    <div className="p-setting__action-row">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleTestWebdav}
                            disabled={operating}
                        >
                            {t('settings.backup.test_connection')}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleBackupToWebDAV}
                            disabled={operating}
                        >
                            {t('settings.backup.backup_to')}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleRestoreFromWebDAV}
                            disabled={operating}
                        >
                            {t('settings.backup.resume_music_sheet')}
                        </Button>
                    </div>
                </>
            )}
        </SettingsCard>
    );
}

/** 格式化日期为 YYYYMMDD_HHmmss（用于默认备份文件名） */
function formatDate(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
