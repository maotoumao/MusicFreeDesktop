import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { Select } from '@renderer/mainWindow/components/ui/Select';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import appConfig from '@infra/appConfig/renderer';
import type { IAudioOutputDevice } from '@appTypes/infra/appConfig';

/**
 * 播放设置
 *
 * 配置项：defaultQuality、whenQualityMissing、clickMusicList、
 *         playError、audioOutputDevice、whenDeviceRemoved、caseSensitiveInSearch
 */
export function PlaybackSection() {
    const { t } = useTranslation();
    const [defaultQuality, setDefaultQuality] = useConfigValue('playMusic.defaultQuality');
    const [whenQualityMissing, setWhenQualityMissing] = useConfigValue(
        'playMusic.whenQualityMissing',
    );
    const [clickMusicList, setClickMusicList] = useConfigValue('playMusic.clickMusicList');
    const [playError, setPlayError] = useConfigValue('playMusic.playError');
    const [whenDeviceRemoved, setWhenDeviceRemoved] = useConfigValue('playMusic.whenDeviceRemoved');
    const [caseSensitive, setCaseSensitive] = useConfigValue('playMusic.caseSensitiveInSearch');

    // 音频输出设备列表
    const [outputDevices, setOutputDevices] = useState<IAudioOutputDevice[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
    const [audioOutputDevice, setAudioOutputDevice] = useConfigValue('playMusic.audioOutputDevice');

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
            const audioOutputs: IAudioOutputDevice[] = devices
                .filter((d) => d.kind === 'audiooutput')
                .map((d) => ({
                    deviceId: d.deviceId,
                    label: d.label,
                    groupId: d.groupId,
                }));
            setOutputDevices(audioOutputs);
        });
    }, []);

    useEffect(() => {
        if (audioOutputDevice) {
            setSelectedDeviceId(audioOutputDevice.deviceId || 'default');
        }
    }, [audioOutputDevice]);

    const handleDeviceChange = useCallback(
        (deviceId: string) => {
            setSelectedDeviceId(deviceId);
            const device = outputDevices.find((d) => d.deviceId === deviceId);
            if (device) {
                setAudioOutputDevice(device);
            } else {
                // 选择 "系统默认" 时清除已保存的设备
                appConfig.setConfig({ 'playMusic.audioOutputDevice': null });
            }
        },
        [outputDevices, setAudioOutputDevice],
    );

    const deviceOptions = useMemo(
        () => [
            { value: 'default', label: t('settings.playback.system_default') },
            ...outputDevices
                .filter((d) => d.deviceId !== 'default')
                .map((d) => ({
                    value: d.deviceId,
                    label: d.label || d.deviceId,
                })),
        ],
        [outputDevices, t],
    );

    return (
        <SettingsCard
            title={t('settings.section_name.playback')}
            subtitle={t('settings.playback.subtitle')}
        >
            <SettingRow
                label={t('settings.playback.default_quality_label')}
                description={t('settings.playback.default_quality_desc')}
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
                label={t('settings.playback.when_quality_missing_label')}
                description={t('settings.playback.when_quality_missing_desc')}
                control={
                    <Select
                        value={whenQualityMissing ?? 'lower'}
                        onChange={setWhenQualityMissing}
                        options={[
                            { value: 'lower', label: t('settings.playback.play_lower') },
                            { value: 'higher', label: t('settings.playback.play_higher') },
                            { value: 'skip', label: t('settings.playback.skip') },
                        ]}
                    />
                }
            />
            <SettingRow
                label={t('settings.playback.double_click_label')}
                description={t('settings.playback.double_click_desc')}
                control={
                    <Select
                        value={clickMusicList ?? 'replace'}
                        onChange={setClickMusicList}
                        options={[
                            { value: 'normal', label: t('settings.playback.add_to_queue') },
                            { value: 'replace', label: t('settings.playback.replace_queue') },
                        ]}
                    />
                }
            />
            <SettingRow
                label={t('settings.playback.play_error_label')}
                description={t('settings.playback.play_error_desc')}
                control={
                    <Select
                        value={playError ?? 'skip'}
                        onChange={setPlayError}
                        options={[
                            { value: 'skip', label: t('settings.playback.skip_to_next') },
                            { value: 'pause', label: t('settings.playback.pause') },
                        ]}
                    />
                }
            />
            <SettingRow
                label={t('settings.playback.output_device_label')}
                description={t('settings.playback.output_device_desc')}
                control={
                    <Select
                        value={selectedDeviceId}
                        onChange={handleDeviceChange}
                        options={deviceOptions}
                    />
                }
            />
            <SettingRow
                label={t('settings.playback.device_removed_label')}
                description={t('settings.playback.device_removed_desc')}
                control={
                    <Select
                        value={whenDeviceRemoved ?? 'play'}
                        onChange={setWhenDeviceRemoved}
                        options={[
                            { value: 'play', label: t('settings.playback.continue_playing') },
                            { value: 'pause', label: t('settings.playback.pause') },
                        ]}
                    />
                }
            />
            <SettingRow
                label={t('settings.playback.case_sensitive_label')}
                description={t('settings.playback.case_sensitive_desc')}
                control={
                    <Select
                        value={caseSensitive ? 'true' : 'false'}
                        onChange={(val) => setCaseSensitive(val === 'true')}
                        options={[
                            { value: 'false', label: t('settings.playback.case_insensitive') },
                            { value: 'true', label: t('settings.playback.case_sensitive') },
                        ]}
                    />
                }
            />
        </SettingsCard>
    );
}
