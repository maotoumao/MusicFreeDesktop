import { memo, useCallback, useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical,
    HelpCircle,
    ArrowUpCircle,
    ArrowRightLeft,
    Sparkles,
    ListPlus,
    SlidersHorizontal,
    Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Badge } from '@renderer/mainWindow/components/ui/Badge';
import { Toggle } from '@renderer/mainWindow/components/ui/Toggle';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import pluginManager from '@infra/pluginManager/renderer';
import { cn } from '@common/cn';

// ── 方法名到 i18n key 的映射 ──

const METHOD_LABEL_MAP: Record<string, string> = {
    search: 'plugin.method_search',
    importMusicItem: 'plugin.method_import_music_item',
    importMusicSheet: 'plugin.method_import_music_sheet',
    getTopLists: 'plugin.method_get_top_lists',
    getLyric: 'plugin.method_get_lyric',
    getRecommendSheetTags: 'plugin.method_get_recommend_sheet_tags',
};

/** 提取为模块常量，避免每次渲染创建新的函数引用 */
const noAnimateLayoutChanges = () => false;

export interface PluginItemProps {
    plugin: IPlugin.IPluginDelegate;
    enabled: boolean;
    sourceRedirectPlatform?: string | null;
    onToggleEnabled: (hash: string, enabled: boolean) => void;
}

/**
 * PluginItem — 单个插件卡片（可排序包装层）
 *
 * 集成 @dnd-kit/sortable 实现拖拽排序。
 * 仅处理拖拽定位逻辑；内容委托给 memo 化的子组件，
 * 从而避免拖拽期间 DndContext 频繁更新引发所有卡片的重渲染。
 */
function PluginItem({ plugin, enabled, sourceRedirectPlatform, onToggleEnabled }: PluginItemProps) {
    const { t } = useTranslation();

    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: plugin.hash,
        animateLayoutChanges: noAnimateLayoutChanges,
    });

    const style = useMemo(
        () => ({
            transform: CSS.Transform.toString(
                transform ? { ...transform, scaleX: 1, scaleY: 1 } : null,
            ),
            transition,
            zIndex: isDragging ? 10 : undefined,
            opacity: isDragging ? 0.6 : 1,
        }),
        [transform, transition, isDragging],
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'p-plugin-manager__item',
                isDragging && 'is-dragging',
                !enabled && 'is-disabled',
            )}
        >
            {/* 第一行：拖拽手柄 + 基本信息 + 右侧操作 */}
            <div className="p-plugin-manager__item-main">
                <div
                    role="button"
                    tabIndex={-1}
                    ref={setActivatorNodeRef}
                    className="p-plugin-manager__drag-handle"
                    aria-label={t('plugin.drag_sort')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical size={16} />
                </div>

                <PluginItemInfo
                    plugin={plugin}
                    enabled={enabled}
                    sourceRedirectPlatform={sourceRedirectPlatform}
                    onToggleEnabled={onToggleEnabled}
                />
            </div>

            {/* 第二行：操作按钮 */}
            <PluginItemActions plugin={plugin} />
        </div>
    );
}

// ── 信息区 + 开关（memo 化，拖拽期间不重渲染） ──

const PluginItemInfo = memo(function PluginItemInfo({
    plugin,
    enabled,
    sourceRedirectPlatform,
    onToggleEnabled,
}: PluginItemProps) {
    const { t } = useTranslation();

    // ── 能力标签：支持xx/xx/xx功能 ──
    const capabilities = useMemo(() => {
        const labels = plugin.supportedMethod
            .filter((m) => m in METHOD_LABEL_MAP)
            .map((m) => t(METHOD_LABEL_MAP[m]));
        if (labels.length === 0) return '';
        return t('plugin.supports_features', { features: labels.join('/') });
    }, [plugin.supportedMethod, t]);

    const handleDescription = useCallback(() => {
        showModal('PluginDescriptionModal', { plugin });
    }, [plugin]);

    return (
        <>
            <div className="p-plugin-manager__item-info">
                <div className="p-plugin-manager__item-title-row">
                    <h3 className="p-plugin-manager__item-name">{plugin.platform}</h3>
                    {plugin.version && (
                        <span className="p-plugin-manager__item-version">
                            {t('plugin.version_label', {
                                version: plugin.version,
                            })}
                        </span>
                    )}
                    {plugin.description && (
                        <button
                            type="button"
                            className="p-plugin-manager__help-btn"
                            onClick={handleDescription}
                            aria-label={t('plugin.plugin_description')}
                        >
                            <HelpCircle size={16} />
                        </button>
                    )}
                    {sourceRedirectPlatform && (
                        <Badge variant="tint">
                            {t('plugin.source_redirect_to', {
                                target: sourceRedirectPlatform,
                            })}
                        </Badge>
                    )}
                </div>
                <p className="p-plugin-manager__item-meta">
                    {plugin.author && <span>{plugin.author}</span>}
                    {plugin.author && capabilities && <span> · </span>}
                    {capabilities && <span>{capabilities}</span>}
                </p>
            </div>

            <div className="p-plugin-manager__item-right">
                <Toggle
                    checked={enabled}
                    onChange={(checked) => onToggleEnabled(plugin.hash, checked)}
                    aria-label={t('plugin.toggle_enable')}
                />
            </div>
        </>
    );
});

// ── 操作按钮行（memo 化，拖拽期间不重渲染） ──

const PluginItemActions = memo(function PluginItemActions({
    plugin,
}: {
    plugin: IPlugin.IPluginDelegate;
}) {
    const { t } = useTranslation();

    // 是否有更新源
    const hasUpdateSource = !!plugin.srcUrl;

    // 更新加载状态
    const [updating, setUpdating] = useState(false);

    // ── 操作回调 ──

    const handleUpdate = useCallback(async () => {
        setUpdating(true);
        try {
            const result = await pluginManager.updatePlugin(plugin.hash);
            if (result.success) {
                showToast(t('plugin.toast_plugin_updated', { plugin: plugin.platform }));
            } else {
                showToast(
                    t('plugin.toast_plugin_already_latest', {
                        plugin: plugin.platform,
                    }),
                );
            }
        } catch {
            showToast(t('plugin.update_failed'), { type: 'warn' });
        } finally {
            setUpdating(false);
        }
    }, [plugin.hash, plugin.platform, t]);

    const handleUninstall = useCallback(() => {
        showModal('ConfirmModal', {
            title: t('plugin.uninstall_plugin'),
            message: t('plugin.uninstall_warning'),
            description: t('plugin.confirm_text_uninstall_plugin', {
                plugin: plugin.platform,
            }),
            confirmText: t('plugin.confirm_uninstall'),
            confirmDanger: true,
            onConfirm: async () => {
                const result = await pluginManager.uninstallPlugin(plugin.hash);
                if (result.success) {
                    showToast(
                        t('plugin.uninstall_successfully', {
                            plugin: plugin.platform,
                        }),
                    );
                } else {
                    showToast(result.message ?? t('plugin.uninstall_failed'), {
                        type: 'warn',
                    });
                    throw new Error('uninstall failed');
                }
            },
        });
    }, [plugin, t]);

    const handleImportTrack = useCallback(() => {
        showModal('PluginImportModal', { plugin, type: 'importMusicItem' });
    }, [plugin]);

    const handleImportSheet = useCallback(() => {
        showModal('PluginImportModal', { plugin, type: 'importMusicSheet' });
    }, [plugin]);

    const handleUserVariables = useCallback(() => {
        showModal('PluginUserVariableModal', { plugin });
    }, [plugin]);

    const handleSourceRedirect = useCallback(() => {
        showModal('PluginSourceRedirectModal', { plugin });
    }, [plugin]);

    return (
        <div className="p-plugin-manager__item-actions">
            {plugin.supportedMethod.includes('getMediaSource') && (
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<ArrowRightLeft size={14} />}
                    onClick={handleSourceRedirect}
                >
                    {t('plugin.source_redirect')}
                </Button>
            )}
            {hasUpdateSource && (
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<ArrowUpCircle size={14} />}
                    onClick={handleUpdate}
                    loading={updating}
                >
                    {t('plugin.update')}
                </Button>
            )}
            {plugin.supportedMethod.includes('importMusicItem') && (
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<Sparkles size={14} />}
                    onClick={handleImportTrack}
                >
                    {t('plugin.method_import_music_item')}
                </Button>
            )}
            {plugin.supportedMethod.includes('importMusicSheet') && (
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<ListPlus size={14} />}
                    onClick={handleImportSheet}
                >
                    {t('plugin.method_import_music_sheet')}
                </Button>
            )}
            {(plugin.userVariables?.length ?? 0) > 0 && (
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<SlidersHorizontal size={14} />}
                    onClick={handleUserVariables}
                >
                    {t('plugin.prop_user_variable')}
                </Button>
            )}
            <Button
                variant="secondary"
                size="sm"
                danger
                icon={<Trash2 size={14} />}
                onClick={handleUninstall}
            >
                {t('plugin.uninstall')}
            </Button>
        </div>
    );
});

export default memo(
    PluginItem,
    (prev, next) =>
        prev.plugin === next.plugin &&
        prev.enabled === next.enabled &&
        prev.sourceRedirectPlatform === next.sourceRedirectPlatform &&
        prev.onToggleEnabled === next.onToggleEnabled,
);
