import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { Toggle } from '@renderer/mainWindow/components/ui/Toggle';
import { Select } from '@renderer/mainWindow/components/ui/Select';
import { CheckboxGroup } from '@renderer/mainWindow/components/ui/CheckboxGroup';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import i18n, { useLangNames } from '@infra/i18n/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import formatFileSize from '@common/formatFileSize';

/**
 * 常规设置
 *
 * 配置项：checkUpdate、closeBehavior、language、maxHistoryLength、
 *         taskbarThumb、musicListHideColumns、缓存
 */
export function GeneralSection() {
    const { t } = useTranslation();
    const [checkUpdate, setCheckUpdate] = useConfigValue('normal.checkUpdate');
    const [closeBehavior, setCloseBehavior] = useConfigValue('normal.closeBehavior');
    const [language, setLanguage] = useConfigValue('normal.language');
    const [maxHistory, setMaxHistory] = useConfigValue('normal.maxHistoryLength');
    const [taskbarThumb, setTaskbarThumb] = useConfigValue('normal.taskbarThumb');
    const [columnsHidden, setColumnsHidden] = useConfigValue('normal.musicListHideColumns');
    const [useCustomTrayMenu, setUseCustomTrayMenu] = useConfigValue('normal.useCustomTrayMenu');

    const langNames = useLangNames();
    const [cacheSize, setCacheSize] = useState('--');

    useEffect(() => {
        systemUtil.getCacheSize().then((bytes) => {
            setCacheSize(formatFileSize(bytes));
        });
    }, []);

    const handleChangeLanguage = useCallback(
        (lang: string) => {
            setLanguage(lang);
            i18n.changeLanguage(lang);
        },
        [setLanguage],
    );

    const handleClearCache = useCallback(() => {
        systemUtil.clearCache();
        setCacheSize('0 B');
    }, []);

    const languageOptions = useMemo(
        () =>
            langNames.map((lang) => ({
                value: lang,
                label: t(`settings.language_name.${lang}`, lang),
            })),
        [langNames, t],
    );

    return (
        <SettingsCard
            title={t('settings.section_name.general')}
            subtitle={t('settings.general.subtitle')}
        >
            <SettingRow
                label={t('settings.general.check_update_label')}
                description={t('settings.general.check_update_desc')}
                control={<Toggle checked={checkUpdate ?? true} onChange={setCheckUpdate} />}
            />
            <SettingRow
                label={t('settings.general.close_behavior_label')}
                description={t('settings.general.close_behavior_desc')}
                control={
                    <Select
                        value={closeBehavior ?? 'minimize'}
                        onChange={setCloseBehavior}
                        options={[
                            { value: 'exit_app', label: t('settings.general.exit_app') },
                            { value: 'minimize', label: t('settings.general.minimize_to_tray') },
                        ]}
                    />
                }
            />
            <SettingRow
                label={t('settings.general.language_label')}
                description={t('settings.general.language_desc')}
                control={
                    <Select
                        value={language ?? 'zh-CN'}
                        onChange={handleChangeLanguage}
                        options={languageOptions}
                    />
                }
            />
            <SettingRow
                label={t('settings.general.max_history_label')}
                description={t('settings.general.max_history_desc')}
                control={
                    <Select
                        value={String(maxHistory ?? 30)}
                        onChange={(val) => setMaxHistory(Number(val))}
                        options={[
                            {
                                value: '15',
                                label: t('settings.general.history_count', { count: 15 }),
                            },
                            {
                                value: '30',
                                label: t('settings.general.history_count', { count: 30 }),
                            },
                            {
                                value: '45',
                                label: t('settings.general.history_count', { count: 45 }),
                            },
                            {
                                value: '60',
                                label: t('settings.general.history_count', { count: 60 }),
                            },
                            {
                                value: '100',
                                label: t('settings.general.history_count', { count: 100 }),
                            },
                            {
                                value: '200',
                                label: t('settings.general.history_count', { count: 200 }),
                            },
                            {
                                value: '300',
                                label: t('settings.general.history_count', { count: 300 }),
                            },
                        ]}
                    />
                }
            />
            {window.globalContext.platform === 'win32' && (
                <SettingRow
                    label={t('settings.general.taskbar_thumb_label')}
                    description={t('settings.general.taskbar_thumb_desc')}
                    control={
                        <Select
                            value={taskbarThumb ?? 'window'}
                            onChange={setTaskbarThumb}
                            options={[
                                { value: 'window', label: t('settings.general.taskbar_window') },
                                { value: 'artwork', label: t('settings.general.taskbar_artwork') },
                            ]}
                        />
                    }
                />
            )}
            <SettingRow
                label={t('settings.general.hide_columns_label')}
                description={t('settings.general.hide_columns_desc')}
                control={
                    <CheckboxGroup
                        value={columnsHidden ?? []}
                        options={[
                            { value: 'duration', label: t('settings.general.col_duration') },
                            { value: 'platform', label: t('settings.general.col_platform') },
                        ]}
                        onChange={setColumnsHidden}
                    />
                }
            />
            {window.globalContext.isWin10OrAbove && (
                <SettingRow
                    label={t('settings.general.custom_tray_menu_label')}
                    description={t('settings.general.custom_tray_menu_desc')}
                    control={
                        <Toggle
                            checked={useCustomTrayMenu ?? true}
                            onChange={setUseCustomTrayMenu}
                        />
                    }
                />
            )}
            <SettingRow
                label={t('settings.general.cache_label')}
                description={t('settings.general.cache_desc')}
                control={
                    <div className="p-setting__cache-row">
                        <span className="p-setting__cache-size">{cacheSize}</span>
                        <Button variant="secondary" size="sm" onClick={handleClearCache}>
                            {t('settings.general.clear_cache')}
                        </Button>
                    </div>
                }
            />
        </SettingsCard>
    );
}
