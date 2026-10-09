// ============================================================================
// QualityPopover — 音质选择气泡面板
// ============================================================================
//
// hover 音质按钮时弹出垂直列表面板，展示 4 种音质选项。
// 点击选项切换当前播放音质，同时更新全局默认音质配置。

import { useCallback, useRef, memo } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import { QUALITY_KEYS } from '@common/constant';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { useQuality } from '@renderer/mainWindow/core/trackPlayer/hooks';
import appConfig from '@infra/appConfig/renderer';
import { showToast } from '../../ui/Toast';

/** 音质 key → i18n key */
const QUALITY_I18N_KEYS: Record<IMusic.IQualityKey, string> = {
    low: 'quality.low',
    standard: 'quality.standard',
    high: 'quality.high',
    super: 'quality.super',
};

/** 从高到低排列，面板自上而下为高 → 低 */
const QUALITY_OPTIONS = [...QUALITY_KEYS].reverse();

/**
 * QualityPopover
 *
 * 音质按钮（文字标签）+ 垂直列表气泡面板。
 * - hover 延迟 120ms 打开 / 200ms 关闭
 * - 4 个选项从上到下：超高音质 → 高音质 → 标准音质 → 低音质
 * - 当前音质显示勾选标记与品牌色
 * - 点击选项：切换当前播放音质 + 更新全局默认音质
 */
const QualityPopover = memo(function QualityPopover() {
    const quality = useQuality();
    const { t } = useTranslation();

    const popoverRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── 显示/隐藏逻辑 ──

    const show = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            popoverRef.current?.classList.add('is-visible');
        }, 120);
    }, []);

    const hide = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            popoverRef.current?.classList.remove('is-visible');
        }, 200);
    }, []);

    // ── 选择音质 ──

    const handleSelect = useCallback(
        async (q: IMusic.IQualityKey) => {
            const success = await trackPlayer.setQuality(q);
            console.log('切换音质结果', { success, quality: q });
            if (success) {
                appConfig.setConfig({ 'playMusic.defaultQuality': q });
            } else {
                showToast(t('quality.unavailable'), { type: 'warn' });
            }
        },
        [quality, t],
    );

    return (
        <div
            className="l-player-bar__popover-anchor l-player-bar__popover-anchor--no-ml"
            onMouseEnter={show}
            onMouseLeave={hide}
        >
            {/* 触发按钮 */}
            <button className="l-player-bar__quality" type="button" title={t('quality.switch')}>
                {t(QUALITY_I18N_KEYS[quality])}
            </button>

            {/* 气泡面板 */}
            <div ref={popoverRef} className="l-player-bar__popover l-player-bar__popover--list">
                {QUALITY_OPTIONS.map((q) => {
                    const isActive = q === quality;
                    return (
                        <button
                            key={q}
                            type="button"
                            className={cn('l-player-bar__quality-option', isActive && 'is-active')}
                            onClick={() => handleSelect(q)}
                        >
                            <span className="l-player-bar__quality-option-label">
                                {t(QUALITY_I18N_KEYS[q])}
                            </span>
                            {isActive && (
                                <Check size={12} className="l-player-bar__quality-option-check" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

export default QualityPopover;
