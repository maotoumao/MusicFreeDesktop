import { useTranslation } from 'react-i18next';
import { Badge } from '@renderer/mainWindow/components/ui/Badge';
import './index.scss';

export interface ThemePreviewProps {
    /** 预览值：`#hex` 纯色 / 图片 URL / undefined */
    preview?: string;
    /** 缩略图 URL（优先于 preview） */
    thumb?: string;
    /** 主题名称，用于 img alt */
    name: string;
    /** 是否为当前激活主题 */
    isActive: boolean;
    /** 是否为默认主题的特殊样式 */
    isDefault?: boolean;
    /** 是否为新主题（展示“新”角标） */
    isNew?: boolean;
}

/**
 * ThemePreview — 主题卡片预览区
 *
 * 统一处理三种预览模式：纯色 / 图片 / fallback，
 * 以及激活态的「使用中」徽章。
 *
 * 设计稿还原（像素级）：
 *   容器: w-full, h-full, position relative
 *   色块: bg inline-style 或 gradient / fill-neutral
 *   图片: object-fit cover
 *   徽章: position absolute, bottom-8 right-8
 */
export function ThemePreview({
    preview,
    thumb,
    name,
    isActive,
    isDefault = false,
    isNew = false,
}: ThemePreviewProps) {
    const { t } = useTranslation();

    const inUseBadge = isActive ? (
        <Badge className="theme-preview__badge" variant="tint">
            {t('theme.in_use')}
        </Badge>
    ) : null;

    const newBadge = isNew ? (
        <Badge className="theme-preview__badge-new" variant="filled" colorScheme="warn">
            {t('theme.badge_new')}
        </Badge>
    ) : null;

    // 默认主题：专用渐变背景
    if (isDefault) {
        return (
            <div className="theme-preview theme-preview--default">
                {newBadge}
                {inUseBadge}
            </div>
        );
    }

    // 纯色预览
    if (preview?.startsWith('#')) {
        return (
            <div className="theme-preview" style={{ backgroundColor: preview }}>
                {newBadge}
                {inUseBadge}
            </div>
        );
    }

    // 图片预览
    const imgSrc = thumb || preview;
    if (imgSrc) {
        return (
            <div className="theme-preview">
                <img className="theme-preview__img" src={imgSrc} alt={name} loading="lazy" />
                {newBadge}
                {inUseBadge}
            </div>
        );
    }

    // Fallback
    return (
        <div className="theme-preview theme-preview--fallback">
            {newBadge}
            {inUseBadge}
        </div>
    );
}

export default ThemePreview;
