import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { Select } from '@renderer/mainWindow/components/ui/Select';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import systemUtil from '@infra/systemUtil/renderer';

/**
 * 下载设置
 *
 * 配置项：download.path、defaultQuality、whenQualityMissing、concurrency
 */
export function DownloadSection() {
    const { t } = useTranslation();
    const [downloadPath, setDownloadPath] = useConfigValue('download.path');
    const [defaultQuality, setDefaultQuality] = useConfigValue('download.defaultQuality');
    const [whenQualityMissing, setWhenQualityMissing] = useConfigValue(
        'download.whenQualityMissing',
    );
    const [concurrency, setConcurrency] = useConfigValue('download.concurrency');

    const handleChoosePath = useCallback(async () => {
        const result = await systemUtil.showOpenDialog({
            properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths[0]) {
            setDownloadPath(result.filePaths[0]);
        }
    }, [setDownloadPath]);

    const effectiveDownloadPath = downloadPath || window.globalContext.appPath.defaultDownloadPath;

    const handleOpenPath = useCallback(() => {
        systemUtil.openPath(effectiveDownloadPath);
    }, [effectiveDownloadPath]);

    return (
        <SettingsCard
            title={t('settings.section_name.download')}
            subtitle={t('settings.download.subtitle')}
        >
            <SettingRow
                label={t('settings.download.path_label')}
                description={t('settings.download.path_desc')}
                control={
                    <div className="p-setting__path-picker">
                        <div className="p-setting__path-display">{effectiveDownloadPath}</div>
                        <Button variant="secondary" size="sm" onClick={handleChoosePath}>
                            {t('settings.download.change')}
                        </Button>
                        <Button
                            variant="icon"
                            size="sq"
                            icon={<FolderOpen width={16} height={16} />}
                            onClick={handleOpenPath}
                        />
                    </div>
                }
            />
            <SettingRow
                label={t('settings.download.default_quality_label')}
                description={t('settings.download.default_quality_desc')}
                control={
                    <Select
                        value={defaultQuality ?? 'standard'}
                        onChange={setDefaultQuality}
                        options={[
                            { value: 'low', label: t('quality.low') },
                            { value: 'standard', label: t('quality.standard') },
                            { value: 'high', label: t('quality.high') },
                            { value: 'super', label: t('quality.super') },
                        ]}
                    />
                }
            />
            <SettingRow
                label={t('settings.download.when_quality_missing_label')}
                description={t('settings.download.when_quality_missing_desc')}
                control={
                    <Select
                        value={whenQualityMissing ?? 'lower'}
                        onChange={setWhenQualityMissing}
                        options={[
                            { value: 'lower', label: t('settings.download.download_lower') },
                            { value: 'higher', label: t('settings.download.download_higher') },
                        ]}
                    />
                }
            />
            <SettingRow
                label={t('settings.download.concurrency_label')}
                description={t('settings.download.concurrency_desc')}
                control={
                    <Select
                        value={String(concurrency ?? 5)}
                        onChange={(val) => setConcurrency(Number(val))}
                        options={[
                            { value: '1', label: '1' },
                            { value: '3', label: '3' },
                            { value: '5', label: '5' },
                            { value: '10', label: '10' },
                        ]}
                    />
                }
            />
        </SettingsCard>
    );
}
