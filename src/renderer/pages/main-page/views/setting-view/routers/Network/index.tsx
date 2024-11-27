import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import InputSettingItem from "../../components/InputSettingItem";
import {useEffect, useState} from "react";
import {normalizeFileSize} from "@/common/normalize-util";
import {Trans, useTranslation} from "react-i18next";
import useAppConfig from "@/hooks/useAppConfig";
import {appUtil} from "@shared/utils/renderer";


export default function Network() {
    const proxyEnabled = !!useAppConfig("network.proxy.enabled");

    const [cacheSize, setCacheSize] = useState(NaN);

    const {t} = useTranslation();

    useEffect(() => {
        appUtil.getCacheSize().then((res) => {
            setCacheSize(res);
        });
    }, []);

    return (
        <div className="setting-view--network-container">
            <CheckBoxSettingItem
                label={t("settings.network.enable_network_proxy")}
                keyPath="network.proxy.enabled"
            ></CheckBoxSettingItem>

            <div className="proxy-container">
                <InputSettingItem
                    width="100%"
                    label={t("settings.network.host")}
                    disabled={!proxyEnabled}
                    keyPath="network.proxy.host"
                    trim
                ></InputSettingItem>
                <InputSettingItem
                    width="100%"
                    label={t("settings.network.port")}
                    disabled={!proxyEnabled}
                    keyPath="network.proxy.port"
                    trim
                ></InputSettingItem>
                <InputSettingItem
                    width="100%"
                    label={t("settings.network.username")}
                    disabled={!proxyEnabled}
                    keyPath="network.proxy.username"
                    trim
                ></InputSettingItem>
                <InputSettingItem
                    width="100%"
                    label={t("settings.network.password")}
                    type="password"
                    disabled={!proxyEnabled}
                    keyPath="network.proxy.password"
                    trim
                ></InputSettingItem>
            </div>

            <div className="setting-row network-cache-container">
                <Trans
                    i18nKey={"settings.network.local_cache"}
                    values={{
                        cacheSize: isNaN(cacheSize) ? "-" : normalizeFileSize(cacheSize),
                    }}
                ></Trans>
                <div
                    role="button"
                    data-type="normalButton"
                    onClick={() => {
                        setCacheSize(0);
                        appUtil.clearCache();
                    }}
                >
                    {t("settings.network.clear_cache")}
                </div>
            </div>
        </div>
    );
}
