import { IAppConfig } from "@/shared/app-config/type";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import MultiRadioGroupSettingItem from "../../components/MultiRadioGroupSettingItem";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";

import "./index.scss";
import { changeLang, getLangList } from "@/shared/i18n/renderer";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { getGlobalContext } from "@/shared/global-context/renderer";

interface IProps {
  data: IAppConfig["normal"];
}

export default function Normal(props: IProps) {
  const { data = {} as IAppConfig["normal"] } = props;

  const { t } = useTranslation();

  const allLangs = getLangList();

  return (
    <div className="setting-view--normal-container">
      <CheckBoxSettingItem
        label={t("settings.normal.check_update")}
        checked={data.checkUpdate}
        keyPath="normal.checkUpdate"
      ></CheckBoxSettingItem>
      <RadioGroupSettingItem
        label={t("settings.normal.close_behavior")}
        keyPath="normal.closeBehavior"
        value={data.closeBehavior}
        options={[
          {
            value: "exit",
            title: t("settings.normal.exit_app"),
          },
          {
            value: "minimize",
            title: t("settings.normal.minimize"),
          },
        ]}
      ></RadioGroupSettingItem>
      {getGlobalContext().platform === "win32" ? (
        <RadioGroupSettingItem
          label={t("settings.normal.taskbar_thumb")}
          keyPath="normal.taskbarThumb"
          value={data.taskbarThumb}
          options={[
            {
              value: "artwork",
              title: t("settings.normal.current_artwork"),
            },
            {
              value: "window",
              title: t("settings.normal.main_window"),
            },
          ]}
        ></RadioGroupSettingItem>
      ) : null}
      <RadioGroupSettingItem
        label={t("settings.normal.max_history_length")}
        keyPath="normal.maxHistoryLength"
        value={data.maxHistoryLength}
        options={[
          {
            value: 15,
          },
          {
            value: 30,
          },
          {
            value: 50,
          },
          {
            value: 100,
          },
          {
            value: 200,
          },
        ]}
      ></RadioGroupSettingItem>
      <MultiRadioGroupSettingItem
        label={t("settings.normal.music_list_hide_columns")}
        keyPath="normal.musicListColumnsShown"
        value={data.musicListColumnsShown}
        options={[
          {
            title: t("media.media_duration"),
            value: "duration",
          },
          {
            title: t("media.media_platform"),
            value: "platform",
          },
        ]}
      ></MultiRadioGroupSettingItem>
      <ListBoxSettingItem
        label={t("settings.normal.languages")}
        keyPath="normal.language"
        value={data.language}
        width={"240px"}
        onChange={async (lang) => {
          const success = await changeLang(lang);
          if (!success) {
            toast.warning(t("settings.normal.toast_switch_language_fail"));
          }
        }}
        options={allLangs}
      ></ListBoxSettingItem>
    </div>
  );
}
