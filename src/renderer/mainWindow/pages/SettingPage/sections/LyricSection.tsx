import { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { Toggle } from '@renderer/mainWindow/components/ui/Toggle';
import { Select, type SelectOption } from '@renderer/mainWindow/components/ui/Select';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import appConfig from '@infra/appConfig/renderer';

const COLOR_SWATCHES = [
    '#ffffff',
    '#34d399',
    '#a78bfa',
    '#f472b6',
    '#60a5fa',
    '#facc15',
    '#f97316',
];

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 80;

/**
 * 歌词设置
 *
 * 配置项：enableDesktopLyric、alwaysOnTop、lockLyric、
 *         fontData、fontColor、strokeColor、fontSize
 */
export function LyricSection() {
    const { t } = useTranslation();
    const [enableDesktopLyric, setEnableDesktopLyric] = useConfigValue('lyric.enableDesktopLyric');
    const [alwaysOnTop, setAlwaysOnTop] = useConfigValue('lyric.alwaysOnTop');
    const [lockLyric, setLockLyric] = useConfigValue('lyric.lockLyric');
    const [fontData, setFontData] = useConfigValue('lyric.fontData');
    const [fontColor, setFontColor] = useConfigValue('lyric.fontColor');
    const [strokeColor, setStrokeColor] = useConfigValue('lyric.strokeColor');
    const [fontSize, setFontSize] = useConfigValue('lyric.fontSize');

    // ── 本地字体列表 ──
    const [fontOptions, setFontOptions] = useState<SelectOption[]>([
        { value: '', label: t('settings.lyric.font_default') },
    ]);
    const fontFamilyMapRef = useRef<Map<string, FontData>>(new Map());

    useEffect(() => {
        let cancelled = false;

        async function loadFonts() {
            try {
                if (!window.queryLocalFonts) return;
                const fonts = await window.queryLocalFonts();
                if (cancelled) return;

                const familyMap = new Map<string, FontData>();
                const options: SelectOption[] = [
                    { value: '', label: t('settings.lyric.font_default') },
                ];
                for (const font of fonts) {
                    if (!familyMap.has(font.family)) {
                        familyMap.set(font.family, {
                            family: font.family,
                            fullName: font.fullName,
                            postscriptName: font.postscriptName,
                            style: font.style,
                        });
                        options.push({ value: font.family, label: font.family });
                    }
                }
                fontFamilyMapRef.current = familyMap;
                setFontOptions(options);
            } catch {
                // 用户拒绝权限或 API 不可用
            }
        }

        loadFonts();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleFontChange = useCallback(
        (family: string) => {
            if (!family) {
                // 直接使用 appConfig.setConfig 规避 hook setter 的 NonNullable 约束
                appConfig.setConfig({ 'lyric.fontData': null });
            } else {
                const realFontData = fontFamilyMapRef.current.get(family);
                if (realFontData) {
                    setFontData(realFontData);
                }
            }
        },
        [setFontData],
    );

    // 字号使用本地缓冲 + blur 提交
    const [localFontSize, setLocalFontSize] = useState<string>(() => String(fontSize ?? 54));

    useEffect(() => {
        setLocalFontSize(String(fontSize ?? 54));
    }, [fontSize]);

    const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalFontSize(e.target.value);
    }, []);

    const commitFontSize = useCallback(
        (val: number) => {
            const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, val));
            setFontSize(clamped);
            setLocalFontSize(String(clamped));
        },
        [setFontSize],
    );

    const handleFontSizeBlur = useCallback(() => {
        const v = Number(localFontSize);
        if (!Number.isNaN(v) && v >= FONT_SIZE_MIN && v <= FONT_SIZE_MAX) {
            setFontSize(v);
        } else {
            // 回退到当前配置值
            setLocalFontSize(String(fontSize ?? 54));
        }
    }, [localFontSize, fontSize, setFontSize]);

    const handleFontSizeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    }, []);

    return (
        <SettingsCard
            title={t('settings.section_name.lyric')}
            subtitle={t('settings.lyric.subtitle')}
        >
            <SettingRow
                label={t('settings.lyric.enable_desktop_label')}
                description={t('settings.lyric.enable_desktop_desc')}
                control={
                    <Toggle
                        checked={enableDesktopLyric ?? false}
                        onChange={setEnableDesktopLyric}
                    />
                }
            />
            <SettingRow
                label={t('settings.lyric.always_on_top_label')}
                description={t('settings.lyric.always_on_top_desc')}
                control={<Toggle checked={alwaysOnTop ?? false} onChange={setAlwaysOnTop} />}
            />
            <SettingRow
                label={t('settings.lyric.lock_label')}
                description={t('settings.lyric.lock_desc')}
                control={<Toggle checked={lockLyric ?? false} onChange={setLockLyric} />}
            />
            <SettingRow
                label={t('settings.lyric.font_label')}
                description={t('settings.lyric.font_desc')}
                control={
                    <Select
                        value={fontData?.family ?? ''}
                        options={fontOptions}
                        onChange={handleFontChange}
                    />
                }
            />
            <SettingRow
                label={t('settings.lyric.font_size_label')}
                description={t('settings.lyric.font_size_desc')}
                control={
                    <div className="p-setting__font-size-stepper">
                        <button
                            type="button"
                            className="p-setting__font-size-step-btn"
                            disabled={(fontSize ?? 54) <= FONT_SIZE_MIN}
                            onClick={() => commitFontSize((fontSize ?? 54) - 1)}
                        >
                            −
                        </button>
                        <input
                            type="text"
                            inputMode="numeric"
                            className="p-setting__font-size-input"
                            value={localFontSize}
                            onChange={handleFontSizeChange}
                            onBlur={handleFontSizeBlur}
                            onKeyDown={handleFontSizeKeyDown}
                        />
                        <button
                            type="button"
                            className="p-setting__font-size-step-btn"
                            disabled={(fontSize ?? 54) >= FONT_SIZE_MAX}
                            onClick={() => commitFontSize((fontSize ?? 54) + 1)}
                        >
                            +
                        </button>
                    </div>
                }
            />
            <SettingRow
                label={t('settings.lyric.font_color_label')}
                description={t('settings.lyric.font_color_desc')}
                control={<ColorPicker value={fontColor ?? '#ffffff'} onChange={setFontColor} />}
            />
            <SettingRow
                label={t('settings.lyric.stroke_color_label')}
                description={t('settings.lyric.stroke_color_desc')}
                control={<ColorPicker value={strokeColor ?? '#f5c542'} onChange={setStrokeColor} />}
            />
        </SettingsCard>
    );
}

/** 内联颜色选择器 — 原生 color input 使用 onBlur 提交 */
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
    const [localColor, setLocalColor] = useState(value);

    useEffect(() => {
        setLocalColor(value);
    }, [value]);

    const handleNativeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalColor(e.target.value);
    }, []);

    const handleNativeBlur = useCallback(() => {
        if (localColor !== value) {
            onChange(localColor);
        }
    }, [localColor, value, onChange]);

    return (
        <div className="p-setting__color-picker">
            <input
                type="color"
                value={localColor}
                onChange={handleNativeChange}
                onBlur={handleNativeBlur}
                className="p-setting__color-input"
            />
            <div className="p-setting__color-swatches">
                {COLOR_SWATCHES.map((color) => (
                    <button
                        type="button"
                        key={color}
                        className={cn(
                            'p-setting__color-swatch-btn',
                            value === color && 'is-selected',
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => onChange(color)}
                    />
                ))}
            </div>
        </div>
    );
}
