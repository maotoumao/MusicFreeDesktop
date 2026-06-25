import { useState, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    SlidersHorizontal,
    PlayCircle,
    Download,
    Mic2,
    Blocks,
    Keyboard,
    Wifi,
    DatabaseBackup,
    Info,
} from 'lucide-react';
import { TabBar, type TabItem } from '@renderer/mainWindow/components/ui/TabBar';
import { GeneralSection } from './sections/GeneralSection';
import { PlaybackSection } from './sections/PlaybackSection';
import { DownloadSection } from './sections/DownloadSection';
import { LyricSection } from './sections/LyricSection';
import { PluginSection } from './sections/PluginSection';
import { ShortcutSection } from './sections/ShortcutSection';
import { NetworkSection } from './sections/NetworkSection';
import { BackupSection } from './sections/BackupSection';
import { AboutSection } from './sections/AboutSection';
import './index.scss';

// ── Section 映射 ──

const SECTION_MAP: Record<string, () => ReactNode> = {
    general: () => <GeneralSection />,
    playback: () => <PlaybackSection />,
    download: () => <DownloadSection />,
    lyrics: () => <LyricSection />,
    plugins: () => <PluginSection />,
    shortcuts: () => <ShortcutSection />,
    network: () => <NetworkSection />,
    backup: () => <BackupSection />,
    about: () => <AboutSection />,
};

/**
 * SettingPage — 设置页面
 *
 * 顶部固定标题 + TabBar，下方独立滚动内容区。
 * 每个 tab 对应一个 section 组件，懒渲染。
 */
export default function SettingPage() {
    const { t } = useTranslation();
    const [activeKey, setActiveKey] = useState('general');

    const sectionTabs: TabItem[] = useMemo(
        () => [
            {
                key: 'general',
                label: t('settings.section_name.general'),
                icon: <SlidersHorizontal width={16} height={16} />,
            },
            {
                key: 'playback',
                label: t('settings.section_name.playback'),
                icon: <PlayCircle width={16} height={16} />,
            },
            {
                key: 'download',
                label: t('settings.section_name.download'),
                icon: <Download width={16} height={16} />,
            },
            {
                key: 'lyrics',
                label: t('settings.section_name.lyric'),
                icon: <Mic2 width={16} height={16} />,
            },
            {
                key: 'plugins',
                label: t('settings.section_name.plugin'),
                icon: <Blocks width={16} height={16} />,
            },
            {
                key: 'shortcuts',
                label: t('settings.section_name.shortcut'),
                icon: <Keyboard width={16} height={16} />,
            },
            {
                key: 'network',
                label: t('settings.section_name.network'),
                icon: <Wifi width={16} height={16} />,
            },
            {
                key: 'backup',
                label: t('settings.section_name.backup'),
                icon: <DatabaseBackup width={16} height={16} />,
            },
            { key: 'about', label: t('common.about'), icon: <Info width={16} height={16} /> },
        ],
        [t],
    );

    const sectionContent = useMemo(() => {
        const factory = SECTION_MAP[activeKey];
        return factory ? factory() : null;
    }, [activeKey]);

    return (
        <div className="p-setting">
            {/* 非滚动区域：标题 + TabBar */}
            <div className="p-setting__header">
                <div className="p-setting__title-row">
                    <h2 className="p-setting__title">{t('settings.title')}</h2>
                </div>

                <TabBar items={sectionTabs} activeKey={activeKey} onChange={setActiveKey} />
            </div>

            {/* 独立滚动区域 */}
            <section className="p-setting__body">
                <div className="p-setting__content">{sectionContent}</div>
            </section>
        </div>
    );
}
