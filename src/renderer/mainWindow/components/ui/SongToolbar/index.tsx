import { type ReactNode } from 'react';
import { Play, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import { Button } from '../Button';
import { Input } from '../Input';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface SongToolbarProps {
    /** 搜索框占位文案，传入即显示搜索框 */
    searchPlaceholder?: string;
    /** 搜索关键词（受控） */
    searchValue?: string;
    /** 搜索关键词变更回调 */
    onSearchChange?: (value: string) => void;
    /** 点击「播放全部」回调 */
    onPlayAll?: () => void;
    /** 「播放全部」按钮文案 @default "播放全部" */
    playAllLabel?: string;
    /** 是否隐藏「播放全部」按钮 @default false */
    hidePlayAll?: boolean;
    /** 禁用所有操作按钮（播放全部、插槽按钮、搜索框） @default false */
    disabled?: boolean;
    /** 操作按钮插槽（插入到「播放全部」右侧） */
    children?: ReactNode;
    /** 额外 className */
    className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// SongToolbar Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * SongToolbar — 组合组件
 *
 * 歌曲列表上方的操作栏：左侧播放全部 + 自定义按钮，右侧搜索框。
 *
 * 设计稿还原（像素级）：
 *   容器: flex, justify-between, items-center, py-12, mb-4
 *   左侧: flex, gap-8, 播放全部 Button(primary, md)
 *   右侧: SearchInput w-200, bg subtle, border default, radius-control
 *         搜索图标 14×14 left padding
 */
export function SongToolbar({
    searchPlaceholder,
    searchValue,
    onSearchChange,
    onPlayAll,
    playAllLabel,
    hidePlayAll = false,
    disabled = false,
    children,
    className,
}: SongToolbarProps) {
    const { t } = useTranslation();
    const resolvedPlayAllLabel = playAllLabel ?? t('playback.play_all');
    return (
        <div className={cn('song-toolbar', disabled && 'is-disabled', className)}>
            {/* ── 左侧操作区 ── */}
            <div className="song-toolbar__left">
                {!hidePlayAll && (
                    <Button
                        variant="primary"
                        size="md"
                        icon={<Play size={16} fill="currentColor" />}
                        onClick={onPlayAll}
                        disabled={disabled}
                    >
                        {resolvedPlayAllLabel}
                    </Button>
                )}
                {children}
            </div>

            {/* ── 右侧搜索 ── */}
            {searchPlaceholder && (
                <div className="song-toolbar__right">
                    <Input
                        className="song-toolbar__search"
                        prefix={<Search size={14} />}
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={
                            onSearchChange ? (e) => onSearchChange(e.target.value) : undefined
                        }
                        allowClear
                        onClear={() => onSearchChange?.('')}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
}

export default SongToolbar;
