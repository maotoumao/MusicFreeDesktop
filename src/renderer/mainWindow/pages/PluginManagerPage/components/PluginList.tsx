import { useCallback, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Blocks } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** 提取为模块常量，避免每次渲染创建新数组引用 */
const DND_MODIFIERS = [restrictToVerticalAxis];
import pluginManager from '@infra/pluginManager/renderer';
import { usePlugins, usePluginMeta } from '@infra/pluginManager/renderer/hooks';
import { sortByPluginOrder } from '@infra/pluginManager/common/sortByOrder';
import { StatusPlaceholder } from '@renderer/mainWindow/components/ui/StatusPlaceholder';
import { RequestStatus, LOCAL_PLUGIN_HASH } from '@common/constant';
import PluginItem from './PluginItem';

/**
 * PluginList — 可拖拽排序的插件列表
 *
 * 使用 @dnd-kit + SortableContext 实现拖拽排序，
 * 拖拽结束后通过 pluginManager.setPluginMeta 持久化排序。
 * 内置插件（LOCAL_PLUGIN_HASH）不显示在列表中。
 */
export default function PluginList() {
    const { t } = useTranslation();
    const plugins = usePlugins();
    const meta = usePluginMeta();

    // 过滤内置插件 + 按 meta.order 排序
    const sortedPlugins = useMemo(() => {
        const filtered = plugins.filter((p) => p.hash !== LOCAL_PLUGIN_HASH);
        return sortByPluginOrder(filtered, meta);
    }, [plugins, meta]);

    const sortedIds = useMemo(() => sortedPlugins.map((p) => p.hash), [sortedPlugins]);

    // ── DnD 传感器 ──
    const sensors = useSensors(useSensor(PointerSensor));

    // ── 拖拽结束 ──
    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = sortedPlugins.findIndex((p) => p.hash === active.id);
            const newIndex = sortedPlugins.findIndex((p) => p.hash === over.id);
            if (oldIndex === -1 || newIndex === -1) return;

            // 计算新顺序
            const reordered = arrayMove(sortedPlugins, oldIndex, newIndex);

            // 为所有插件分配确定性 order（解决首次拖拽时无 order 的插件乱序问题）
            const updates = reordered.map((p, i) => ({
                hash: p.hash,
                meta: { order: i },
            }));

            // 批量更新：先同步刷新 atom（UI 即时响应），再异步持久化
            pluginManager.batchSetPluginMeta(updates);
        },
        [sortedPlugins],
    );

    const handleToggleEnabled = useCallback((hash: string, enabled: boolean) => {
        pluginManager.setPluginMeta(hash, { enabled });
    }, []);

    if (sortedPlugins.length === 0) {
        return (
            <StatusPlaceholder
                status={RequestStatus.Done}
                isEmpty
                emptyIcon={Blocks}
                emptyTitle={t('plugin.info_hint_you_have_no_plugin')}
            />
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={DND_MODIFIERS}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
                <div className="p-plugin-manager__list">
                    {sortedPlugins.map((plugin) => (
                        <PluginItem
                            key={plugin.hash}
                            plugin={plugin}
                            enabled={meta[plugin.hash]?.enabled !== false}
                            sourceRedirectPlatform={
                                meta[plugin.hash]?.sourceRedirectPlatform ?? null
                            }
                            onToggleEnabled={handleToggleEnabled}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
