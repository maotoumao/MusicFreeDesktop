import { useTranslation } from 'react-i18next';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { Toggle } from '@renderer/mainWindow/components/ui/Toggle';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';

/**
 * 插件设置
 *
 * 配置项：autoUpdatePlugin、notCheckPluginVersion
 */
export function PluginSection() {
    const { t } = useTranslation();
    const [autoUpdate, setAutoUpdate] = useConfigValue('plugin.autoUpdatePlugin');
    const [notCheckVersion, setNotCheckVersion] = useConfigValue('plugin.notCheckPluginVersion');

    return (
        <SettingsCard
            title={t('settings.section_name.plugin')}
            subtitle={t('settings.plugin.subtitle')}
        >
            <SettingRow
                label={t('settings.plugin.auto_update_label')}
                description={t('settings.plugin.auto_update_desc')}
                control={<Toggle checked={autoUpdate ?? false} onChange={setAutoUpdate} />}
            />
            <SettingRow
                label={t('settings.plugin.skip_version_check_label')}
                description={t('settings.plugin.skip_version_check_desc')}
                control={
                    <Toggle checked={notCheckVersion ?? false} onChange={setNotCheckVersion} />
                }
            />
        </SettingsCard>
    );
}
