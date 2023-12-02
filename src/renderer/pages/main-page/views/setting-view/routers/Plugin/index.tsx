import { IAppConfig } from "@/common/app-config/type";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";

interface IProps {
  data: IAppConfig["plugin"];
}

export default function Plugin(props: IProps) {
  const { data = {} as IAppConfig["plugin"] } = props;

  return (
    <div className="setting-view--plugin-container">
      <CheckBoxSettingItem
        keyPath="plugin.autoUpdatePlugin"
        checked={data?.autoUpdatePlugin}
        label="打开软件时自动更新插件"
      ></CheckBoxSettingItem>
      <CheckBoxSettingItem
        label="安装插件时不校验版本"
        keyPath="plugin.notCheckPluginVersion"
        checked={data?.notCheckPluginVersion}
      ></CheckBoxSettingItem>
    </div>
  );
}
