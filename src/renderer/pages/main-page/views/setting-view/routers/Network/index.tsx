import { IAppConfig } from "@/common/app-config/type";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import InputSettingItem from "../../components/InputSettingItem";
import { ipcRendererInvoke, ipcRendererSend } from "@/common/ipc-util/renderer";
import { useEffect, useState } from "react";
import { normalizeFileSize } from "@/common/normalize-util";

interface IProps {
  data: IAppConfig["network"];
}

export default function Network(props: IProps) {
  const { data = {} as IAppConfig["network"] } = props;

  const proxyEnabled = !!data.proxy?.enabled;

  const [cacheSize, setCacheSize] = useState(NaN);

  useEffect(() => {
    ipcRendererInvoke("get-cache-size").then((res) => {
      setCacheSize(res);
    });
  }, []);

  return (
    <div className="setting-view--network-container">
      <CheckBoxSettingItem
        label="启用网络代理"
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
          label="主机"
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
          label="端口"
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
          label="账号"
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
          label="密码"
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
        本地缓存： {isNaN(cacheSize) ? "-" : normalizeFileSize(cacheSize)}
        <div
          role="button"
          data-type="normalButton"
          onClick={() => {
            setCacheSize(0);
            ipcRendererSend("clear-cache");
          }}
        >
          清空缓存
        </div>
      </div>
    </div>
  );
}
