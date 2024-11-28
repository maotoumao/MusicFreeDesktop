import AppConfig from "@shared/app-config/renderer";
import {IAppConfig} from "@/types/app-config";
import {useEffect, useState} from "react";


export default function useAppConfig<K extends keyof IAppConfig>(configKey: K): IAppConfig[K] {
    const [state, setState] = useState<IAppConfig[K]>(AppConfig.getConfig(configKey));

    useEffect(() => {
        const callback = (patch: IAppConfig, fullConfig: IAppConfig) => {
            if (configKey in patch) {
                setState(fullConfig[configKey]);
            }
        };

        AppConfig.onConfigUpdate(callback);

        return () => {
            AppConfig.offConfigUpdate(callback);
        };
    }, []);


    return state;
}
