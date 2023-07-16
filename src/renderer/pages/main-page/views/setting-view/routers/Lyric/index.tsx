import { IAppConfig } from "@/common/app-config/type";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import "./index.scss";
import ColorPickerSettingItem from "../../components/ColorPickerSettingItem";
import { ipcRendererInvoke, ipcRendererSend } from "@/common/ipc-util/renderer";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";

interface IProps {
  data: IAppConfig["lyric"];
}

const numberArray = Array(64).fill(0).map((_, index) => ({value: 16 + index}));

export default function Lyric(props: IProps) {
  const { data } = props;

  return (
    <div className="setting-view--lyric-container">
      <CheckBoxSettingItem
        label="启用桌面歌词"
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
      <ColorPickerSettingItem
        label="描边颜色"
        value={data.strokeColor}
        keyPath="lyric.strokeColor"
      ></ColorPickerSettingItem>
      <ListBoxSettingItem keyPath='lyric.fontSize' value={data.fontSize} options={numberArray} label="字体大小"></ListBoxSettingItem>
    </div>
  );
}
