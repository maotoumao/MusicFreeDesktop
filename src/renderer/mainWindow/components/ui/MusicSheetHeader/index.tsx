import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import { Artwork } from '../Artwork';
import { showModal } from '../Modal/modalManager';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface MusicSheetHeaderProps {
    /** 歌单 / 专辑 / 排行榜数据 */
    musicSheet: IMusic.IMusicSheetItem;
    /** 无封面时的自定义占位内容（默认显示 album-cover.jpg） */
    placeholderIcon?: ReactNode;
    /** 封面右侧、标题下方的自定义操作区（如按钮组） */
    actions?: ReactNode;
    /** 隐藏封面右下角来源徽章（如本地歌单不需要显示） */
    hideSourceBadge?: boolean;
    /** 额外 className */
    className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// MusicSheetHeader Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * MusicSheetHeader — 组合组件
 *
 * 歌单 / 排行榜 / 专辑详情页的头部区域：
 * 左侧 200×200 封面 + 右侧（标题 + 描述 + 元信息）。
 *
 * 设计稿还原（像素级）：
 *   容器: flex, gap 28px, align-items center, mb 24px
 *   封面: 200×200, radius-card(12px), shadow-md, ring 1px border-subtle
 *         来源徽章 absolute bottom-8 right-8, bg overlay blur, 11px
 *   标题: display(32px), extrabold, tracking-tight, line-clamp-2
 *   描述: label(13px), text-muted, line-clamp-3, 溢出时显示"阅读更多"弹窗
 *   元信息: label(13px), text-secondary, · 分隔
 */
export function MusicSheetHeader({
    musicSheet,
    placeholderIcon,
    actions,
    hideSourceBadge,
    className,
}: MusicSheetHeaderProps) {
    const { t } = useTranslation();
    const { artwork, title, description, artist, platform, worksNum } = musicSheet;

    // ── 描述溢出检测 ──
    const descRef = useRef<HTMLParagraphElement>(null);
    const [descOverflow, setDescOverflow] = useState(false);

    useLayoutEffect(() => {
        const el = descRef.current;
        if (!el) {
            setDescOverflow(false);
            return;
        }

        const check = () => setDescOverflow(el.scrollHeight > el.clientHeight);
        check();

        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, [description]);

    const handleReadMore = useCallback(() => {
        if (!description) return;
        showModal('TextModal', {
            title: title || t('media.unknown_title'),
            content: description,
        });
    }, [title, description]);

    // ── 元信息条目 ──
    const metaItems: ReactNode[] = [];

    if (artist) {
        metaItems.push(<span key="artist">{artist}</span>);
    }
    if (worksNum != null) {
        metaItems.push(<span key="count">{t('media.works_count', { count: worksNum })}</span>);
    }

    // 条目之间插入分隔符
    const metaRendered = metaItems.flatMap((item, i) =>
        i > 0
            ? [
                  <span key={`sep-${i}`} className="music-sheet-header__meta-sep">
                      ·
                  </span>,
                  item,
              ]
            : [item],
    );

    return (
        <div className={cn('music-sheet-header', className)}>
            {/* ── 封面 ── */}
            <div className="music-sheet-header__cover">
                <Artwork src={artwork} size="lg" rounded="md" fallback={placeholderIcon} />
                {!hideSourceBadge && platform && (
                    <span className="music-sheet-header__source-badge">{platform}</span>
                )}
            </div>

            {/* ── 信息区 ── */}
            <div className="music-sheet-header__info">
                <h1 className="music-sheet-header__title">{title || t('media.unknown_title')}</h1>

                {description && (
                    <div className="music-sheet-header__desc-wrap">
                        <p ref={descRef} className="music-sheet-header__desc">
                            {description}
                        </p>
                        {descOverflow && (
                            <button
                                type="button"
                                className="music-sheet-header__desc-expand"
                                onClick={handleReadMore}
                            >
                                {t('app.read_more')}
                            </button>
                        )}
                    </div>
                )}

                {metaRendered.length > 0 && (
                    <div className="music-sheet-header__meta">{metaRendered}</div>
                )}

                {actions && <div className="music-sheet-header__actions">{actions}</div>}
            </div>
        </div>
    );
}

export default MusicSheetHeader;
