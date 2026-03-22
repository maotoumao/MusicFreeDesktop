// ============================================================================
// LyricSettingsPopover — 歌词设置气泡面板
// ============================================================================
//
// 绝对定位气泡，包含字号调节、翻译开关、下载歌词、搜索替换歌词等功能。

import { useCallback, useRef, useEffect, useState, memo, type RefObject } from 'react';
import { Download, Search, Unlink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import {
    useLyric,
    useAssociatedLyric,
    useCurrentMusic,
} from '@renderer/mainWindow/core/trackPlayer/hooks';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { showModal } from '../../ui/Modal/modalManager';
import { showToast } from '../../ui/Toast';
import systemUtil from '@infra/systemUtil/renderer';
import fsUtil from '@infra/fsUtil/renderer';
import mediaMeta from '@infra/mediaMeta/renderer';

interface LyricSettingsPopoverProps {
    /** 是否打开 */
    open: boolean;
    /** 请求关闭 */
    onClose: () => void;
    /** 触发按钮的 ref，外部点击判断时需排除 */
    triggerRef: RefObject<HTMLButtonElement | null>;
    /** 当前字号缩放 (0.8 ~ 1.3) */
    fontScale: number;
    /** 字号变化回调 */
    onFontScaleChange: (scale: number) => void;
}

export default memo(function LyricSettingsPopover({
    open,
    onClose,
    triggerRef,
    fontScale,
    onFontScaleChange,
}: LyricSettingsPopoverProps) {
    const { t } = useTranslation();
    const lyricState = useLyric();
    const associatedLyric = useAssociatedLyric();
    const currentMusic = useCurrentMusic();
    const panelRef = useRef<HTMLDivElement>(null);

    // 歌词偏移状态
    const [lyricOffset, setLyricOffset] = useState(() => trackPlayer.getLyricOffset());

    // 面板打开时同步偏移值（防止关闭后复用旧 state）
    useEffect(() => {
        if (open) {
            setLyricOffset(trackPlayer.getLyricOffset());
        }
    }, [open]);

    // 点击外部关闭
    useEffect(() => {
        if (!open) return;

        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                panelRef.current &&
                !panelRef.current.contains(target) &&
                !triggerRef.current?.contains(target)
            ) {
                onClose();
            }
        };

        // 延迟绑定，避免打开面板的点击事件立即触发关闭
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handler);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handler);
        };
    }, [open, onClose, triggerRef]);

    /** 歌词偏移变化 */
    const handleLyricOffsetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setLyricOffset(val);
        trackPlayer.setLyricOffset(val);
    }, []);

    /** 重置歌词偏移 */
    const handleResetOffset = useCallback(() => {
        setLyricOffset(0);
        trackPlayer.setLyricOffset(0);
    }, []);

    /** 下载歌词 — 通过系统对话框选择保存位置 */
    const handleDownload = useCallback(
        async (format: 'lrc' | 'txt') => {
            const parser = lyricState?.parser;
            if (!parser) return;

            const musicItem = parser.musicItem;
            const rawName = musicItem?.title ?? 'lyrics';
            const fileName = rawName.replace(/[/\\:*?"<>|]/g, '_');

            const result = await systemUtil.showSaveDialog({
                title: t('lyric.save_lyric'),
                defaultPath: `${fileName}.${format}`,
                filters: [
                    {
                        name: format === 'lrc' ? t('lyric.lrc_file') : t('lyric.txt_file'),
                        extensions: [format],
                    },
                ],
            });

            if (result.canceled || !result.filePath) return;

            const content = parser.toString({
                withTimestamp: format === 'lrc',
                type: 'raw',
            });

            if (!content) {
                showToast(t('lyric.no_lyric_to_save'), { type: 'warn' });
                return;
            }

            try {
                await fsUtil.writeFile(result.filePath, content, { encoding: 'utf-8' });
                showToast(t('lyric.lyric_saved'));
            } catch {
                showToast(t('lyric.save_failed'), { type: 'warn' });
            }
        },
        [lyricState],
    );

    /** 搜索歌词 */
    const handleSearchLyric = useCallback(() => {
        onClose();
        showModal('SearchLyricModal');
    }, [onClose]);

    /** 取消关联歌词 */
    const handleUnlinkLyric = useCallback(async () => {
        if (!currentMusic) return;
        await mediaMeta.setMeta(currentMusic.platform, String(currentMusic.id), {
            associatedLyric: null,
        });
        await trackPlayer.refreshLyric();
        showToast(t('lyric.unlinked'));
    }, [currentMusic]);

    if (!open) return null;

    return (
        <div ref={panelRef} className="l-fullscreen-player__settings">
            <div className="l-fullscreen-player__settings-title">{t('lyric.settings')}</div>

            {/* 字号调节 */}
            <div className="l-fullscreen-player__settings-section">
                <div className="l-fullscreen-player__settings-row">
                    <span className="l-fullscreen-player__settings-label">
                        {t('lyric.font_scale')}
                    </span>
                    <button
                        type="button"
                        className="l-fullscreen-player__settings-reset"
                        onClick={() => onFontScaleChange(1)}
                        disabled={fontScale === 1}
                    >
                        {Math.round(fontScale * 100)}%
                    </button>
                </div>
                <input
                    type="range"
                    min="0.8"
                    max="1.3"
                    step="0.05"
                    value={fontScale}
                    onChange={(e) => onFontScaleChange(Number(e.target.value))}
                    className="l-fullscreen-player__settings-slider"
                />
            </div>

            {/* 歌词进度偏移 */}
            <div className="l-fullscreen-player__settings-section">
                <div className="l-fullscreen-player__settings-row">
                    <span className="l-fullscreen-player__settings-label">
                        {t('lyric.lyric_offset')}
                    </span>
                    <button
                        type="button"
                        className="l-fullscreen-player__settings-reset"
                        onClick={handleResetOffset}
                        disabled={lyricOffset === 0}
                    >
                        {lyricOffset === 0
                            ? t('lyric.no_offset')
                            : `${lyricOffset > 0 ? '+' : ''}${lyricOffset.toFixed(1)}s`}
                    </button>
                </div>
                <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.5"
                    value={lyricOffset}
                    onChange={handleLyricOffsetChange}
                    className="l-fullscreen-player__settings-slider"
                />
            </div>

            {/* 下载歌词 */}
            <div className="l-fullscreen-player__settings-section">
                <div className="l-fullscreen-player__settings-label">
                    {t('lyric.download_lyric')}
                </div>
                <div className="l-fullscreen-player__settings-btn-group">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download size={14} />}
                        className="l-fullscreen-player__settings-btn"
                        onClick={() => handleDownload('lrc')}
                    >
                        LRC
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download size={14} />}
                        className="l-fullscreen-player__settings-btn"
                        onClick={() => handleDownload('txt')}
                    >
                        TXT
                    </Button>
                </div>
            </div>

            {/* 更多操作 */}
            <div className="l-fullscreen-player__settings-section">
                <div className="l-fullscreen-player__settings-label">{t('lyric.more_actions')}</div>
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<Search size={14} />}
                    className="l-fullscreen-player__settings-action"
                    onClick={handleSearchLyric}
                >
                    {t('lyric.search_and_replace')}
                </Button>
            </div>

            {/* 关联歌词来源 */}
            {associatedLyric && (
                <div className="l-fullscreen-player__settings-section l-fullscreen-player__settings-section--bordered">
                    <div className="l-fullscreen-player__settings-associated-info">
                        {t('lyric.source_info', {
                            platform: associatedLyric.platform,
                            title: associatedLyric.title,
                            artist: associatedLyric.artist ? ` - ${associatedLyric.artist}` : '',
                        })}
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<Unlink size={14} />}
                        className="l-fullscreen-player__settings-action"
                        onClick={handleUnlinkLyric}
                    >
                        {t('lyric.unlink')}
                    </Button>
                </div>
            )}
        </div>
    );
});
