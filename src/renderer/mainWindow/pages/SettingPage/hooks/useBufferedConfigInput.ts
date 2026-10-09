import { useState, useEffect, useCallback, useRef } from 'react';
import type { IAppConfig } from '@appTypes/infra/appConfig';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';

/**
 * 为文本输入框提供"本地缓冲 + 失焦提交"语义。
 *
 * - `localValue` 绑定 `<Input value />`
 * - `handleChange` 绑定 `<Input onChange />`
 * - `handleBlur` 绑定 `<Input onBlur />`
 *
 * 只有在 blur 时才写入 appConfig，避免逐字写盘。
 */
export function useBufferedConfigInput<K extends keyof IAppConfig>(
    key: K,
): {
    localValue: string;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleBlur: () => void;
} {
    const [configValue, setConfigValue] = useConfigValue(key);
    const [localValue, setLocalValue] = useState<string>(() => String(configValue ?? ''));

    // 外部配置变更 → 同步到本地（仅当外来变更时）
    const isFocused = useRef(false);
    useEffect(() => {
        if (!isFocused.current) {
            setLocalValue(String(configValue ?? ''));
        }
    }, [configValue]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        isFocused.current = true;
        setLocalValue(e.target.value);
    }, []);

    const handleBlur = useCallback(() => {
        isFocused.current = false;
        // 仅在值实际发生变化时写入
        if (localValue !== String(configValue ?? '')) {
            setConfigValue(localValue as NonNullable<IAppConfig[K]>);
        }
    }, [localValue, configValue, setConfigValue]);

    return { localValue, handleChange, handleBlur };
}
