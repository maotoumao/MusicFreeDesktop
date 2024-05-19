import { IAppConfig } from "@/shared/app-config/type";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import { useTranslation } from "react-i18next";

interface IProps {
  data: IAppConfig["plugin"];
}

export default function Plugin(props: IProps) {
  const { data = {} as IAppConfig["plugin"] } = props;

  const { t } = useTranslation();

  return (
    <div className="setting-view--plugin-container">
      <CheckBoxSettingItem
        keyPath="plugin.autoUpdatePlugin"
        checked={data?.autoUpdatePlugin}
        label={t("settings.plugin.auto_update_plugin")}
      ></CheckBoxSettingItem>
      <CheckBoxSettingItem
        label={t("settings.plugin.not_check_plugin_version")}
        keyPath="plugin.notCheckPluginVersion"
        checked={data?.notCheckPluginVersion}
      ></CheckBoxSettingItem>
    </div>
  );
}
