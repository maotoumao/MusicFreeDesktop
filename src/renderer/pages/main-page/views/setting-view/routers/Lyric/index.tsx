import { IAppConfig } from "@/shared/app-config/type";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import "./index.scss";
import ColorPickerSettingItem from "../../components/ColorPickerSettingItem";
import { ipcRendererInvoke, ipcRendererSend } from "@/shared/ipc/renderer";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import FontPickerSettingItem from "../../components/FontPickerSettingItem";
import { IfTruthy } from "@/renderer/components/Condition";
import { useTranslation } from "react-i18next";
import { getGlobalContext } from "@/shared/global-context/renderer";

interface IProps {
  data: IAppConfig["lyric"];
}

const numberArray = Array(65)
  .fill(0)
  .map((_, index) => 16 + index);

export default function Lyric(props: IProps) {
  const { data = {} as IAppConfig["lyric"] } = props;

  const { t } = useTranslation();

  return (
    <div className="setting-view--lyric-container">
      <IfTruthy condition={getGlobalContext().platform === "darwin"}>
        <CheckBoxSettingItem
          label={t("settings.lyric.enable_status_bar_lyric")}
          checked={data.enableStatusBarLyric}
          keyPath="lyric.enableStatusBarLyric"
        ></CheckBoxSettingItem>
      </IfTruthy>
      <CheckBoxSettingItem
        label={t("settings.lyric.enable_desktop_lyric")}
        checked={data.enableDesktopLyric}
        keyPath="lyric.enableDesktopLyric"
        onCheckChanged={(checked) => {
          ipcRendererInvoke("set-lyric-window", checked);
        }}
      ></CheckBoxSettingItem>
      {/* <CheckBoxSettingItem
        label="置顶桌面歌词"
        checked={data.alwaysOnTop}
        keyPath="lyric.alwaysOnTop"
      ></CheckBoxSettingItem> */}
      <CheckBoxSettingItem
        label={t("settings.lyric.lock_desktop_lyric")}
        checked={data.lockLyric}
        keyPath="lyric.lockLyric"
        onCheckChanged={(checked) => {
          ipcRendererSend("set-desktop-lyric-lock", checked);
        }}
      ></CheckBoxSettingItem>
      <FontPickerSettingItem
        label={t("settings.lyric.font")}
        keyPath="lyric.fontData"
        value={data.fontData}
      ></FontPickerSettingItem>
      <ListBoxSettingItem
        keyPath="lyric.fontSize"
        value={data.fontSize}
        options={numberArray}
        label={t("settings.lyric.font_size")}
      ></ListBoxSettingItem>
      <ColorPickerSettingItem
        label={t("settings.lyric.font_color")}
        value={data.fontColor}
        keyPath="lyric.fontColor"
      ></ColorPickerSettingItem>
      <ColorPickerSettingItem
        label={t("settings.lyric.stroke_color")}
        value={data.strokeColor}
        keyPath="lyric.strokeColor"
      ></ColorPickerSettingItem>
    </div>
  );
}
