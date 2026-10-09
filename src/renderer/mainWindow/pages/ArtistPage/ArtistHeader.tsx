import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { cn } from '@common/cn';
import { Artwork } from '../../components/ui/Artwork';
import './ArtistHeader.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface ArtistHeaderProps {
    artist: IArtist.IArtistItem;
    className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const DESC_CLAMP_THRESHOLD = 60;

// ────────────────────────────────────────────────────────────────────────────
// ArtistHeader
// ────────────────────────────────────────────────────────────────────────────

/**
 * ArtistHeader — 作者详情页头部
 *
 * 布局与 MusicSheetHeader 同级视觉重量：
 *   左侧 200×200 圆形头像 + 右侧（名称 + 描述 + 元信息）
 */
export function ArtistHeader({ artist, className }: ArtistHeaderProps) {
    const { avatar, name, description, platform, fans } = artist;
    const { t } = useTranslation();

    const [descExpanded, setDescExpanded] = useState(false);
    const descLong = !!description && description.length > DESC_CLAMP_THRESHOLD;

    // ── 元信息 ──
    const metaItems: ReactNode[] = [];
    if (fans != null) {
        metaItems.push(
            <span key="fans">
                {fans} {t('media.fans')}
            </span>,
        );
    }

    const metaRendered = metaItems.flatMap((item, i) =>
        i > 0
            ? [
                  <span key={`sep-${i}`} className="p-artist-header__meta-sep">
                      ·
                  </span>,
                  item,
              ]
            : [item],
    );

    return (
        <div className={cn('p-artist-header', className)}>
            {/* ── 圆形头像 ── */}
            <div className="p-artist-header__cover">
                <Artwork
                    src={avatar}
                    alt={name}
                    size="lg"
                    rounded="lg"
                    fallback={<User className="p-artist-header__cover-placeholder" />}
                    className="p-artist-header__avatar"
                />
                {platform && <span className="p-artist-header__source-badge">{platform}</span>}
            </div>

            {/* ── 信息区 ── */}
            <div className="p-artist-header__info">
                <h1 className="p-artist-header__name">{name || t('media.unknown_artist')}</h1>

                {description && (
                    <div className="p-artist-header__desc-wrap">
                        <p
                            className={cn(
                                'p-artist-header__desc',
                                !descExpanded && 'p-artist-header__desc--clamped',
                            )}
                        >
                            {description}
                        </p>
                        {descLong && (
                            <button
                                type="button"
                                className="p-artist-header__desc-expand"
                                onClick={() => setDescExpanded((v) => !v)}
                            >
                                {descExpanded ? t('common.collapse') : t('common.expand')}
                            </button>
                        )}
                    </div>
                )}

                {metaRendered.length > 0 && (
                    <div className="p-artist-header__meta">{metaRendered}</div>
                )}
            </div>
        </div>
    );
}
