import { IAppConfig } from "@/common/app-config/type";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import "./index.scss";
import ColorPickerSettingItem from "../../components/ColorPickerSettingItem";
import { ipcRendererSend } from "@/common/ipc-util/renderer";

interface IProps {
  data: IAppConfig["lyric"];
}
export default function Lyric(props: IProps) {
  const { data } = props;

  return (
    <div className="setting-view--lyric-container">
      <CheckBoxSettingItem
        label="启用桌面歌词"
        checked={data.enableDesktopLyric}
        keyPath="lyric.enableDesktopLyric"
      ></CheckBoxSettingItem>
      <CheckBoxSettingItem
        label="置顶桌面歌词"
        checked={data.alwaysOnTop}
        keyPath="lyric.alwaysOnTop"
      ></CheckBoxSettingItem>
      <CheckBoxSettingItem
        label="锁定桌面歌词"
        checked={data.lockLyric}
        keyPath="lyric.lockLyric"
        onCheckChanged={(checked) => {
          ipcRendererSend("set-desktop-lyric-lock", checked);
        }}
      ></CheckBoxSettingItem>
      <ColorPickerSettingItem
        label="字体颜色"
        value={data.fontColor}
        keyPath="lyric.fontColor"
      ></ColorPickerSettingItem>
    </div>
  );
}
