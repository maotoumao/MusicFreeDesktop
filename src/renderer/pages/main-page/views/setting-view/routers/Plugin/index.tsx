import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import { useTranslation } from "react-i18next";



export default function Plugin() {

    const { t } = useTranslation();

    return (
        <div className="setting-view--plugin-container">
            <CheckBoxSettingItem
                keyPath="plugin.autoUpdatePlugin"
                label={t("settings.plugin.auto_update_plugin")}
            ></CheckBoxSettingItem>
            <CheckBoxSettingItem
                label={t("settings.plugin.not_check_plugin_version")}
                keyPath="plugin.notCheckPluginVersion"
            ></CheckBoxSettingItem>
        </div>
    );
}
