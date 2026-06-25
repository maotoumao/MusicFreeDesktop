import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import { SettingsCard } from '../components/SettingsCard';
import { SettingRow } from '../components/SettingRow';
import { Toggle } from '@renderer/mainWindow/components/ui/Toggle';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';
import appConfig from '@infra/appConfig/renderer';
import shortCutRenderer from '@infra/shortCut/renderer';
import type {
    ShortCutAction,
    IShortCutBinding,
    IShortCutMap,
    IGlobalShortCutRegistration,
} from '@appTypes/infra/shortCut';

type ShortcutScope = 'local' | 'global';

interface ShortcutDisplayItem {
    action: ShortCutAction;
    label: string;
    local: string;
    global: string;
}

const ACTION_LABEL_KEYS: Record<ShortCutAction, string> = {
    'play/pause': 'settings.shortcut.action_play_pause',
    'skip-previous': 'settings.shortcut.action_previous',
    'skip-next': 'settings.shortcut.action_next',
    'volume-up': 'settings.shortcut.action_volume_up',
    'volume-down': 'settings.shortcut.action_volume_down',
    'toggle-desktop-lyric': 'settings.shortcut.action_desktop_lyric',
    'like/dislike': 'settings.shortcut.action_like_dislike',
    'toggle-minimode': 'settings.shortcut.action_toggle_minimode',
};

const ACTIONS: ShortCutAction[] = [
    'play/pause',
    'skip-next',
    'skip-previous',
    'volume-up',
    'volume-down',
    'toggle-desktop-lyric',
    'like/dislike',
    'toggle-minimode',
];

const KEY_DISPLAY_MAP: Record<string, string> = {
    CmdOrCtrl: 'Ctrl',
    Control: 'Ctrl',
    Meta: 'Win',
    ' ': 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
    Delete: 'Del',
    Backspace: '⌫',
    Enter: 'Enter',
    Tab: 'Tab',
};

function formatKeyDisplay(accelerator: string): string {
    if (!accelerator) return '';
    return accelerator
        .split('+')
        .map((k) => KEY_DISPLAY_MAP[k] ?? k)
        .join(' + ');
}

/**
 * 快捷键设置
 *
 * 配置项：shortCut.enableLocal、shortCut.enableGlobal、shortCut.shortcuts
 */
export function ShortcutSection() {
    const { t } = useTranslation();
    const [enableLocal, setEnableLocal] = useConfigValue('shortCut.enableLocal');
    const [enableGlobal, setEnableGlobal] = useConfigValue('shortCut.enableGlobal');
    const [shortcutsMap, setShortcutsMap] = useConfigValue('shortCut.shortcuts');

    const [capture, setCapture] = useState<{ action: ShortCutAction; scope: ShortcutScope } | null>(
        null,
    );

    // 对应 scope 被禁用时取消正在进行的录制
    useEffect(() => {
        if (!capture) return;
        if (
            (capture.scope === 'local' && !enableLocal) ||
            (capture.scope === 'global' && !enableGlobal)
        ) {
            setCapture(null);
        }
    }, [capture, enableLocal, enableGlobal]);

    const shortcuts: ShortcutDisplayItem[] = useMemo(() => {
        const map = shortcutsMap ?? ({} as Partial<IShortCutMap>);
        return ACTIONS.map((action) => {
            const binding: IShortCutBinding | undefined = map[action];
            return {
                action,
                label: t(ACTION_LABEL_KEYS[action]),
                local: formatKeyDisplay(binding?.local?.join('+') ?? ''),
                global: formatKeyDisplay(binding?.global?.join('+') ?? ''),
            };
        });
    }, [shortcutsMap]);

    // 录制快捷键
    useEffect(() => {
        if (!capture) return;

        const handler = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                setCapture(null);
                return;
            }

            const keys: string[] = [];
            if (event.ctrlKey || event.metaKey) keys.push('CmdOrCtrl');
            if (event.altKey) keys.push('Alt');
            if (event.shiftKey) keys.push('Shift');

            const key = event.key;
            const normalized = key.length === 1 ? key.toUpperCase() : key;
            if (!['Control', 'Meta', 'Alt', 'Shift'].includes(normalized)) {
                keys.push(normalized);
            }

            if (keys.length === 0) return;

            const hasNonModifier = keys.some((k) => !['CmdOrCtrl', 'Alt', 'Shift'].includes(k));
            if (!hasNonModifier) return;

            const currentMap =
                appConfig.getConfigByKey('shortCut.shortcuts') ?? ({} as IShortCutMap);

            // 同 scope 冲突检测：清除占用相同快捷键的其他 action
            const newMap = { ...currentMap };
            const newAccelerator = keys.join('+');
            for (const action of ACTIONS) {
                if (action === capture.action) continue;
                const binding = newMap[action];
                const existing = binding?.[capture.scope];
                if (existing && existing.join('+') === newAccelerator) {
                    newMap[action] = { ...binding, [capture.scope]: null };
                }
            }

            newMap[capture.action] = {
                ...(newMap[capture.action] ?? {}),
                [capture.scope]: keys,
            };
            setShortcutsMap(newMap as IShortCutMap);
            setCapture(null);
        };

        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [capture, setShortcutsMap]);

    // 全局快捷键注册状态
    const [globalStatus, setGlobalStatus] = useState<IGlobalShortCutRegistration[]>(() =>
        shortCutRenderer.getCachedGlobalStatus(),
    );

    useEffect(() => {
        const handler = (regs: IGlobalShortCutRegistration[]) => setGlobalStatus(regs);
        shortCutRenderer.onGlobalShortCutStatusChanged(handler);
        return () => shortCutRenderer.offGlobalShortCutStatusChanged(handler);
    }, []);

    const failedActions = useMemo(() => {
        const set = new Set<ShortCutAction>();
        for (const reg of globalStatus) {
            if (!reg.registered) set.add(reg.action);
        }
        return set;
    }, [globalStatus]);

    const handleClear = useCallback(
        (action: ShortCutAction, scope: ShortcutScope) => {
            const currentMap =
                appConfig.getConfigByKey('shortCut.shortcuts') ?? ({} as IShortCutMap);
            const currentBinding = currentMap[action] ?? {};
            const newBinding: IShortCutBinding = {
                ...currentBinding,
                [scope]: null,
            };
            const newMap = { ...currentMap, [action]: newBinding };
            setShortcutsMap(newMap as IShortCutMap);
        },
        [setShortcutsMap],
    );

    return (
        <SettingsCard
            title={t('settings.section_name.shortcut')}
            subtitle={t('settings.shortcut.subtitle')}
        >
            <SettingRow
                label={t('settings.shortcut.enable_local_label')}
                description={t('settings.shortcut.enable_local_desc')}
                control={<Toggle checked={enableLocal ?? true} onChange={setEnableLocal} />}
            />
            <SettingRow
                label={t('settings.shortcut.enable_global_label')}
                description={t('settings.shortcut.enable_global_desc')}
                control={<Toggle checked={enableGlobal ?? false} onChange={setEnableGlobal} />}
            />

            <div className="p-setting__shortcut-list">
                {shortcuts.map((item) => (
                    <div key={item.action} className="p-setting__shortcut-item">
                        <div>
                            <div className="p-setting__shortcut-label">{item.label}</div>
                            <div className="p-setting__shortcut-desc">
                                {t('settings.shortcut.record_hint')}
                            </div>
                        </div>
                        <ShortcutCell
                            label={t('settings.shortcut.scope_local')}
                            value={item.local}
                            disabled={!enableLocal}
                            onRecord={() => setCapture({ action: item.action, scope: 'local' })}
                            onCancel={() => setCapture(null)}
                            onClear={() => handleClear(item.action, 'local')}
                            active={capture?.action === item.action && capture.scope === 'local'}
                        />
                        <ShortcutCell
                            label={t('settings.shortcut.scope_global')}
                            value={item.global}
                            disabled={!enableGlobal}
                            error={enableGlobal && failedActions.has(item.action)}
                            onRecord={() => setCapture({ action: item.action, scope: 'global' })}
                            onCancel={() => setCapture(null)}
                            onClear={() => handleClear(item.action, 'global')}
                            active={capture?.action === item.action && capture.scope === 'global'}
                        />
                    </div>
                ))}
            </div>
        </SettingsCard>
    );
}

/** 快捷键单元格：点击格子进入录制态，失焦自动退出 */
function ShortcutCell({
    label,
    value,
    disabled,
    error,
    onRecord,
    onCancel,
    onClear,
    active,
}: {
    label: string;
    value: string;
    disabled?: boolean;
    error?: boolean;
    onRecord: () => void;
    onCancel: () => void;
    onClear: () => void;
    active?: boolean;
}) {
    const cellRef = useRef<HTMLDivElement>(null);
    const prevActiveRef = useRef(active);
    const { t } = useTranslation();

    // 录制结束后 blur，避免 focus-visible 残留
    useEffect(() => {
        if (prevActiveRef.current && !active) {
            cellRef.current?.blur();
        }
        prevActiveRef.current = active;
    }, [active]);

    const handleCellClick = useCallback(() => {
        if (!active && !disabled) {
            onRecord();
        }
    }, [active, disabled, onRecord]);

    const handleBlur = useCallback(
        (e: React.FocusEvent) => {
            if (!active) return;
            // 焦点移到格子内部元素（如取消按钮）时不退出
            if (cellRef.current?.contains(e.relatedTarget as Node)) return;
            onCancel();
        },
        [active, onCancel],
    );

    const handleClearClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onClear();
        },
        [onClear],
    );

    const handleCancelClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onCancel();
        },
        [onCancel],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!active && !disabled && e.key === 'Enter') {
                e.preventDefault();
                onRecord();
            }
        },
        [active, disabled, onRecord],
    );

    return (
        <div
            ref={cellRef}
            role="button"
            tabIndex={disabled ? -1 : 0}
            className={cn(
                'p-setting__shortcut-cell',
                active && 'is-active',
                disabled && 'is-disabled',
                error && 'is-error',
            )}
            onClick={handleCellClick}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
        >
            <div>
                <div className="p-setting__shortcut-scope">{label}</div>
                <div className="p-setting__shortcut-value">
                    {active
                        ? t('settings.shortcut.recording_hint')
                        : value || t('settings.shortcut.not_set')}
                </div>
            </div>
            {active && (
                <button
                    type="button"
                    className="p-setting__shortcut-action-btn"
                    onClick={handleCancelClick}
                >
                    {t('common.cancel')}
                </button>
            )}
            {!active && value && (
                <button
                    type="button"
                    className="p-setting__shortcut-action-btn"
                    disabled={disabled}
                    onClick={handleClearClick}
                >
                    {t('settings.shortcut.clear_binding')}
                </button>
            )}
        </div>
    );
}
