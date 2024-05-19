import { IAppConfig } from "@/shared/app-config/type";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import InputSettingItem from "../../components/InputSettingItem";
import { ipcRendererInvoke, ipcRendererSend } from "@/shared/ipc/renderer";
import { useEffect, useState } from "react";
import { normalizeFileSize } from "@/common/normalize-util";
import { Trans, useTranslation } from "react-i18next";

interface IProps {
  data: IAppConfig["network"];
}

export default function Network(props: IProps) {
  const { data = {} as IAppConfig["network"] } = props;

  const proxyEnabled = !!data.proxy?.enabled;

  const [cacheSize, setCacheSize] = useState(NaN);

  const { t } = useTranslation();

  useEffect(() => {
    ipcRendererInvoke("get-cache-size").then((res) => {
      setCacheSize(res);
    });
  }, []);

  return (
    <div className="setting-view--network-container">
      <CheckBoxSettingItem
        label={t("settings.network.enable_network_proxy")}
        checked={proxyEnabled}
        keyPath="network.proxy.enabled"
        onCheckChanged={(checked) => {
          ipcRendererSend("set-proxy", {
            ...(data.proxy ?? {}),
            enabled: checked,
          });
        }}
      ></CheckBoxSettingItem>

      <div className="proxy-container">
        <InputSettingItem
          width="100%"
          label={t("settings.network.host")}
          disabled={!proxyEnabled}
          keyPath="network.proxy.host"
          value={data.proxy?.host}
          onChange={(val) => {
            console.log(val);
            ipcRendererSend("set-proxy", {
              ...(data.proxy ?? { enabled: false }),
              host: val.trim(),
            });
          }}
        ></InputSettingItem>
        <InputSettingItem
          width="100%"
          label={t("settings.network.port")}
          disabled={!proxyEnabled}
          keyPath="network.proxy.port"
          value={data.proxy?.port}
          onChange={(val) => {
            ipcRendererSend("set-proxy", {
              ...(data.proxy ?? { enabled: false }),
              port: val.trim(),
            });
          }}
        ></InputSettingItem>
        <InputSettingItem
          width="100%"
          label={t("settings.network.username")}
          disabled={!proxyEnabled}
          keyPath="network.proxy.username"
          value={data.proxy?.username}
          onChange={(val) => {
            ipcRendererSend("set-proxy", {
              ...(data.proxy ?? { enabled: false }),
              username: val.trim(),
            });
          }}
        ></InputSettingItem>
        <InputSettingItem
          width="100%"
          label={t("settings.network.password")}
          type="password"
          disabled={!proxyEnabled}
          keyPath="network.proxy.password"
          value={data.proxy?.password}
          onChange={(val) => {
            ipcRendererSend("set-proxy", {
              ...(data.proxy ?? { enabled: false }),
              password: val.trim(),
            });
          }}
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
            ipcRendererSend("clear-cache");
          }}
        >
          {t("settings.network.clear_cache")}
        </div>
      </div>
    </div>
  );
}
