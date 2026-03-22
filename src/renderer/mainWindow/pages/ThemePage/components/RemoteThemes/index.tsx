import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Palette } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { atom, getDefaultStore } from 'jotai';
import { useAtomValue } from 'jotai/react';
import themePack, { useCurrentThemePack, useInstalledThemePacks } from '@infra/themepack/renderer';
import type { IThemePack } from '@appTypes/infra/themepack';
import { RequestStatus } from '@common/constant';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { StatusPlaceholder } from '@renderer/mainWindow/components/ui/StatusPlaceholder';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import { showContextMenu } from '@renderer/mainWindow/components/ui/ContextMenu/contextMenuManager';
import { ThemeCard } from '../ThemeCard';
import { ThemePreview } from '../ThemePreview';
import { Chip } from '@renderer/mainWindow/components/ui/Chip';
import { A } from '@renderer/mainWindow/components/ui/A';
import { THEME_STORE_BASE_URLS, GITHUB_REPO_URL } from '../../constants';
import './index.scss';

/** publish.json 顶层结构 */
interface IRemotePublishData {
    version: string;
    updatedAt: string;
    themes: IRemoteThemeItem[];
}

/** 远程主题列表中的单个条目（扁平结构，与 publish.json 中 themes[] 一致） */
interface IRemoteThemeItem {
    id: string;
    name: string;
    packageName: string;
    author?: string;
    authorUrl?: string;
    description?: string;
    version?: string;
    tags?: string[];
    preview?: string;
    themeUrl: string;
    hash: string;
    publishName: string;
    createdAt?: string;
    isNew?: boolean;
}

/** 本地解析后的远程主题视图模型 */
interface IRemoteThemeViewModel {
    item: IRemoteThemeItem;
    /** .mftheme 下载 URL */
    srcUrl: string;
    /** 处理后的预览图 URL */
    previewUrl?: string;
}

/**
 * 将远程相对路径或 #hex 纯色解析为完整 URL。
 */
function resolvePreviewUrl(raw: string | undefined, baseUrl: string): string | undefined {
    if (!raw) return undefined;
    if (raw.startsWith('#')) return raw;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `${baseUrl}${raw}`;
}

/**
 * 竞速请求多个镜像，返回第一个成功的结果。
 */
async function raceWithData(
    urls: string[],
): Promise<{ data: IRemoteThemeItem[]; baseUrl: string }> {
    const controllers = urls.map(() => new AbortController());

    const promises = urls.map(async (baseUrl, i) => {
        const resp = await fetch(`${baseUrl}publish.json`, {
            signal: controllers[i].signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as IRemotePublishData;
        return { data: json.themes, baseUrl };
    });

    try {
        const result = await Promise.any(promises);
        controllers.forEach((c) => c.abort());
        return result;
    } catch {
        throw new Error('All mirrors failed');
    }
}

/**
 * RemoteThemes — 在线主题市场
 *
 * 从 GitHub 远程仓库拉取主题列表并展示为卡片 grid。
 * 多镜像竞速策略，支持下载安装和版本更新。
 */

// ── Jotai State（模块级，app session 内持久化） ──

const store = getDefaultStore();
const remoteThemesAtom = atom<IRemoteThemeViewModel[]>([]);
const remoteStatusAtom = atom<RequestStatus>(RequestStatus.Idle);
const installingHashAtom = atom<Set<string>>(new Set<string>());

export default function RemoteThemes() {
    const { t } = useTranslation();
    const currentPack = useCurrentThemePack();
    const installedPacks = useInstalledThemePacks();

    const status = useAtomValue(remoteStatusAtom);
    const themes = useAtomValue(remoteThemesAtom);
    const installingHashes = useAtomValue(installingHashAtom);
    const [activeTag, setActiveTag] = useState<string | null>(null);

    /** 从主题数据中提取去重排序的标签列表 */
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        for (const vm of themes) {
            vm.item.tags?.forEach((tag) => tagSet.add(tag));
        }
        return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    }, [themes]);

    /** 根据活动标签过滤主题 */
    const filteredThemes = useMemo(
        () => (activeTag ? themes.filter((vm) => vm.item.tags?.includes(activeTag)) : themes),
        [themes, activeTag],
    );

    const loadThemes = useCallback(async () => {
        if (store.get(remoteStatusAtom) === RequestStatus.Done) return;

        store.set(remoteStatusAtom, RequestStatus.Pending);
        try {
            const { data, baseUrl } = await raceWithData(THEME_STORE_BASE_URLS);

            const viewModels: IRemoteThemeViewModel[] = data.map((item) => ({
                item,
                srcUrl: `${baseUrl}${item.themeUrl}`,
                previewUrl: resolvePreviewUrl(item.preview, baseUrl),
            }));

            store.set(remoteThemesAtom, viewModels);
            store.set(remoteStatusAtom, RequestStatus.Done);
        } catch {
            store.set(remoteStatusAtom, RequestStatus.Error);
        }
    }, []);

    useEffect(() => {
        loadThemes();
    }, [loadThemes]);

    const doInstall = useCallback(
        async (vm: IRemoteThemeViewModel, useAfterInstall: boolean) => {
            store.set(installingHashAtom, (prev) => new Set(prev).add(vm.item.hash));
            try {
                const existingLocal = installedPacks.find(
                    (p) => p.name === vm.item.name && !p.builtin,
                );
                const tp = await themePack.installRemoteThemePack(vm.srcUrl, existingLocal?.hash);
                if (tp) {
                    showToast(t('theme.install_theme_success', { name: tp.name }));
                    if (useAfterInstall) {
                        await themePack.selectTheme(tp);
                    }
                } else {
                    showToast(t('theme.install_theme_fail', { reason: 'unknown' }), {
                        type: 'warn',
                    });
                    throw new Error('install returned null');
                }
            } catch (err) {
                showToast(t('theme.install_theme_fail', { reason: 'network' }), {
                    type: 'warn',
                });
                throw err;
            } finally {
                store.set(installingHashAtom, (prev) => {
                    const next = new Set(prev);
                    next.delete(vm.item.hash);
                    return next;
                });
            }
        },
        [installedPacks, t],
    );

    const handleInstall = useCallback(
        (vm: IRemoteThemeViewModel) => doInstall(vm, true),
        [doInstall],
    );

    const handleDownloadOnly = useCallback(
        (vm: IRemoteThemeViewModel) => doInstall(vm, false),
        [doInstall],
    );

    const handleUse = useCallback(async (installed: IThemePack) => {
        await themePack.selectTheme(installed);
    }, []);

    if (status !== RequestStatus.Done || themes.length === 0) {
        return (
            <StatusPlaceholder
                status={status}
                isEmpty={themes.length === 0}
                errorTitle={t('theme.load_remote_theme_error')}
                onRetry={() => {
                    store.set(remoteStatusAtom, RequestStatus.Idle);
                    loadThemes();
                }}
                emptyTitle={t('theme.remote_theme_empty')}
            />
        );
    }

    return (
        <div className="remote-themes">
            <p className="remote-themes__submit-hint">
                <Trans
                    i18nKey="theme.how_to_submit_new_theme"
                    components={{
                        Github: <A href={GITHUB_REPO_URL}>{''}</A>,
                    }}
                />
            </p>
            {allTags.length > 0 && (
                <div className="remote-themes__filter-bar">
                    <Chip
                        label={t('theme.filter_all')}
                        active={activeTag === null}
                        onClick={() => setActiveTag(null)}
                    />
                    {allTags.map((tag) => (
                        <Chip
                            key={tag}
                            label={tag}
                            active={activeTag === tag}
                            onClick={() => setActiveTag(tag)}
                        />
                    ))}
                </div>
            )}
            <div className="remote-themes__grid">
                {filteredThemes.map((vm) => {
                    const installed = installedPacks.find((p) => p.name === vm.item.name);
                    const isActive = currentPack?.name === vm.item.name;
                    const hasUpdate =
                        installed &&
                        !installed.builtin &&
                        (installed.version && vm.item.version
                            ? installed.version !== vm.item.version
                            : installed.hash !== vm.item.hash);
                    const needsDownload = !installed || hasUpdate;
                    const isInstalling = installingHashes.has(vm.item.hash);
                    const installLabel = hasUpdate
                        ? t('theme.update_theme')
                        : installed
                          ? t('theme.use_theme')
                          : t('theme.download_and_use');

                    return (
                        <ThemeCard
                            key={vm.item.hash}
                            name={vm.item.name}
                            author={vm.item.author}
                            active={isActive}
                            preview={
                                <ThemePreview
                                    preview={vm.previewUrl}
                                    name={vm.item.name}
                                    isActive={isActive}
                                    isNew={vm.item.isNew}
                                />
                            }
                            footer={
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={isInstalling}
                                    icon={
                                        needsDownload ? (
                                            <Download width={14} height={14} />
                                        ) : (
                                            <Palette width={14} height={14} />
                                        )
                                    }
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (installed && !hasUpdate) {
                                            handleUse(installed);
                                        } else {
                                            handleDownloadOnly(vm);
                                        }
                                    }}
                                >
                                    {hasUpdate
                                        ? t('theme.update_only')
                                        : needsDownload
                                          ? t('theme.download_only')
                                          : t('theme.use_theme')}
                                </Button>
                            }
                            onClick={() => {
                                if (isInstalling) return;
                                showModal('ThemeDetailModal', {
                                    name: vm.item.name,
                                    author: vm.item.author,
                                    authorUrl: vm.item.authorUrl,
                                    description: vm.item.description,
                                    version: vm.item.version,
                                    preview: vm.previewUrl,
                                    onInstall:
                                        installed && !hasUpdate
                                            ? () => handleUse(installed)
                                            : () => handleInstall(vm),
                                    installLabel,
                                    needsDownload,
                                    ...(needsDownload && {
                                        onDownloadOnly: () => handleDownloadOnly(vm),
                                        downloadOnlyLabel: hasUpdate
                                            ? t('theme.update_only')
                                            : t('theme.download_only'),
                                    }),
                                });
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                showContextMenu(
                                    'RemoteThemeMenu',
                                    { x: e.clientX, y: e.clientY },
                                    {
                                        name: vm.item.name,
                                        author: vm.item.author,
                                        authorUrl: vm.item.authorUrl,
                                        description: vm.item.description,
                                        version: vm.item.version,
                                        preview: vm.previewUrl,
                                        onInstall:
                                            installed && !hasUpdate
                                                ? () => handleUse(installed)
                                                : () => handleInstall(vm),
                                        installLabel,
                                        needsDownload,
                                        ...(needsDownload && {
                                            onDownloadOnly: () => handleDownloadOnly(vm),
                                            downloadOnlyLabel: hasUpdate
                                                ? t('theme.update_only')
                                                : t('theme.download_only'),
                                        }),
                                    },
                                );
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
