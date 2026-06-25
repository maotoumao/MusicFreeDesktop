import { useState, useEffect, useCallback } from 'react';
import appConfig from '@infra/appConfig/renderer';
import type { IAppConfig, ConfigSource } from '@appTypes/infra/appConfig';

/**
 * 读取并订阅单个 appConfig 配置项。
 * 返回 [value, setter] 元组，setter 会同时写入 appConfig。
 *
 * 适用于 Toggle、Select 等"即时提交"控件。
 */
export function useConfigValue<K extends keyof IAppConfig>(
    key: K,
): [IAppConfig[K], (val: NonNullable<IAppConfig[K]>) => void] {
    const [value, setValue] = useState<IAppConfig[K]>(() => appConfig.getConfigByKey(key));

    useEffect(() => {
        const handler = (patch: IAppConfig, _config: IAppConfig, _source: ConfigSource) => {
            if (key in (patch as Record<string, unknown>)) {
                setValue(patch[key]);
            }
        };
        appConfig.onConfigUpdated(handler);
        return () => {
            appConfig.offConfigUpdated(handler);
        };
    }, [key]);

    const update = useCallback(
        (val: NonNullable<IAppConfig[K]>) => {
            appConfig.setConfig({ [key]: val } as IAppConfig);
        },
        [key],
    );

    return [value, update];
}
