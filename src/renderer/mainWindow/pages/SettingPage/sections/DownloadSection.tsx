import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { Select } from '@renderer/mainWindow/components/ui/Select';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import systemUtil from '@infra/systemUtil/renderer';

/**
 * 下载设置
 *
 * 配置项：download.path、defaultQuality、whenQualityMissing、concurrency、
 * interval（启动间隔）、intervalJitter（随机抖动）
 */
export function DownloadSection() {
    const { t } = useTranslation();
    const [downloadPath, setDownloadPath] = useConfigValue('download.path');
    const [defaultQuality, setDefaultQuality] = useConfigValue('download.defaultQuality');
    const [whenQualityMissing, setWhenQualityMissing] = useConfigValue(
        'download.whenQualityMissing',
    );
    const [concurrency, setConcurrency] = useConfigValue('download.concurrency');
    const [interval, setInterval] = useConfigValue('download.interval');
    const [intervalJitter, setIntervalJitter] = useConfigValue('download.intervalJitter');

    // 间隔 / 抖动：本地缓冲 + 失焦提交（取整并夹紧到 0~60）
    const [intervalInput, setIntervalInput] = useState(() => String(interval ?? 0));
    const [jitterInput, setJitterInput] = useState(() => String(intervalJitter ?? 0));

    useEffect(() => {
        setIntervalInput(String(interval ?? 0));
    }, [interval]);
    useEffect(() => {
        setJitterInput(String(intervalJitter ?? 0));
    }, [intervalJitter]);

    const clampSeconds = useCallback((raw: string): number => {
        const n = Math.round(Number(raw));
        if (!Number.isFinite(n)) return 0;
        return Math.min(60, Math.max(0, n));
    }, []);

    const commitInterval = useCallback(() => {
        const n = clampSeconds(intervalInput);
        setIntervalInput(String(n));
        if (n !== (interval ?? 0)) setInterval(n);
        // 抖动不应超过基准间隔，间隔调小时同步收窄抖动
        if ((intervalJitter ?? 0) > n) {
            setJitterInput(String(n));
            setIntervalJitter(n);
        }
    }, [clampSeconds, intervalInput, interval, setInterval, intervalJitter, setIntervalJitter]);

    const commitJitter = useCallback(() => {
        // 抖动夹紧到 [0, interval]，避免实际间隔出现负值
        const n = Math.min(clampSeconds(jitterInput), interval ?? 0);
        setJitterInput(String(n));
        if (n !== (intervalJitter ?? 0)) setIntervalJitter(n);
    }, [clampSeconds, jitterInput, interval, intervalJitter, setIntervalJitter]);

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
            <SettingRow
                label={t('settings.download.interval_label')}
                description={t('settings.download.interval_desc')}
                control={
                    <Input
                        type="number"
                        min={0}
                        max={60}
                        step={1}
                        value={intervalInput}
                        onChange={(e) => setIntervalInput(e.target.value)}
                        onBlur={commitInterval}
                        suffix={t('settings.download.seconds_unit')}
                    />
                }
            />
            <SettingRow
                label={t('settings.download.interval_jitter_label')}
                description={t('settings.download.interval_jitter_desc')}
                control={
                    <Input
                        type="number"
                        min={0}
                        max={60}
                        step={1}
                        value={jitterInput}
                        onChange={(e) => setJitterInput(e.target.value)}
                        onBlur={commitJitter}
                        suffix={t('settings.download.seconds_unit')}
                    />
                }
            />
        </SettingsCard>
    );
}
