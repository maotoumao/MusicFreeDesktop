import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import systemUtil from '@infra/systemUtil/renderer';
import audioFingerprint from '@infra/audioFingerprint/renderer';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import formatFileSize from '@common/formatFileSize';

/**
 * 去重设置
 *
 * 配置项：localMusic.fingerprintCacheDir（歌曲指纹缓存目录）
 * 缓存占用与清空走指纹 IPC，目录切换即时生效（旧目录文件保留为孤儿，需手动删除）。
 */
export function DeduplicateSection() {
    const { t } = useTranslation();
    const [cacheDir, setCacheDir] = useConfigValue('localMusic.fingerprintCacheDir');
    const [sizeBytes, setSizeBytes] = useState(0);

    useEffect(() => {
        audioFingerprint
            .getCacheInfo()
            .then((info) => setSizeBytes(info.sizeBytes + (info.marksSizeBytes ?? 0)))
            .catch(() => {
                // 读不到只影响展示
            });
    }, [cacheDir]);

    const handleChoosePath = async () => {
        const result = await systemUtil.showOpenDialog({
            properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths[0]) {
            setCacheDir(result.filePaths[0]);
        }
    };

    const handleOpenPath = () => {
        if (cacheDir) systemUtil.openPath(cacheDir);
    };

    const handleClearCache = async () => {
        await audioFingerprint.clearCache();
        const info = await audioFingerprint.getCacheInfo();
        setSizeBytes(info.sizeBytes + (info.marksSizeBytes ?? 0));
        showToast(t('settings.deduplicate.cleared'));
    };

    return (
        <SettingsCard
            title={t('settings.section_name.deduplicate')}
            subtitle={t('settings.deduplicate.subtitle')}
        >
            <SettingRow
                label={t('settings.deduplicate.path_label')}
                description={t('settings.deduplicate.path_desc')}
                control={
                    <div className="p-setting__path-picker">
                        <div
                            className="p-setting__path-display p-setting__path-display--clickable"
                            role="button"
                            title={cacheDir}
                            onClick={handleOpenPath}
                        >
                            {cacheDir}
                        </div>
                        <Button variant="secondary" size="sm" onClick={handleChoosePath}>
                            {t('settings.deduplicate.path_change')}
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
                label={t('settings.deduplicate.size_label')}
                control={
                    <div className="p-setting__path-picker">
                        <div className="p-setting__path-display">{formatFileSize(sizeBytes)}</div>
                        <Button variant="secondary" size="sm" onClick={handleClearCache}>
                            {t('settings.deduplicate.clear')}
                        </Button>
                    </div>
                }
            />
        </SettingsCard>
    );
}
