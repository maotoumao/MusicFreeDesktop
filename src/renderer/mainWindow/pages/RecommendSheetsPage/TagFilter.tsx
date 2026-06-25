import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@common/cn';
import { Chip } from '../../components/ui/Chip';

/** 默认标签（所有插件通用） */
const DEFAULT_TAG: IMedia.IUnique = { id: '', title: '' };

export interface TagFilterProps {
    /** 标签数据 */
    tags: IPlugin.IGetRecommendSheetTagsResult | null;
    /** 当前选中的标签 */
    selectedTag: IMedia.IUnique;
    /** 选中标签变更回调 */
    onTagChange: (tag: IMedia.IUnique) => void;
}

/**
 * TagFilter — 标签筛选栏
 *
 * 顶行：默认标签（带下拉箭头） + pinned 标签
 * 下拉面板：按分组展示全部标签
 */
export function TagFilter({ tags, selectedTag, onTagChange }: TagFilterProps) {
    const { t } = useTranslation();
    const [panelOpen, setPanelOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭面板
    useEffect(() => {
        if (!panelOpen) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [panelOpen]);

    const handleDefaultClick = useCallback(() => {
        setPanelOpen((prev) => !prev);
    }, []);

    const handlePinnedClick = useCallback(
        (tag: IMedia.IUnique) => {
            onTagChange(tag);
        },
        [onTagChange],
    );

    const handlePanelTagClick = useCallback(
        (tag: IMedia.IUnique) => {
            onTagChange(tag);
            setPanelOpen(false);
        },
        [onTagChange],
    );

    const pinnedTags = tags?.pinned ?? [];
    const groupedTags = tags?.data ?? [];
    const hasDropdown = groupedTags.length > 0;

    return (
        <div className="p-recommend-sheets__tag-filter" ref={panelRef}>
            {/* 标签行 */}
            <div className="p-recommend-sheets__tag-filter-row">
                <Chip
                    label={
                        selectedTag.id === DEFAULT_TAG.id
                            ? t('playlist.default_tag')
                            : (selectedTag.title ?? t('playlist.default_tag'))
                    }
                    active={selectedTag.id === DEFAULT_TAG.id || panelOpen}
                    onClick={hasDropdown ? handleDefaultClick : undefined}
                    suffix={
                        hasDropdown ? (
                            <ChevronDown
                                size={14}
                                className={cn(
                                    'p-recommend-sheets__tag-filter-chevron',
                                    panelOpen && 'is-open',
                                )}
                            />
                        ) : undefined
                    }
                />
                {pinnedTags.map((tag) => (
                    <Chip
                        key={tag.id}
                        label={tag.title}
                        active={selectedTag.id === tag.id}
                        onClick={() => handlePinnedClick(tag)}
                    />
                ))}
            </div>

            {/* 下拉面板 */}
            {panelOpen && groupedTags.length > 0 && (
                <div className="p-recommend-sheets__tag-filter-panel">
                    {groupedTags.map((group, idx) => (
                        <div className="p-recommend-sheets__tag-filter-panel-group" key={idx}>
                            {group.title && (
                                <div className="p-recommend-sheets__tag-filter-group-title">
                                    {group.title}
                                </div>
                            )}
                            <div className="p-recommend-sheets__tag-filter-group-tags">
                                {(group.data ?? []).map((tag) => (
                                    <Chip
                                        key={tag.id}
                                        label={tag.title}
                                        active={selectedTag.id === tag.id}
                                        onClick={() => handlePanelTagClick(tag)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export { DEFAULT_TAG };
