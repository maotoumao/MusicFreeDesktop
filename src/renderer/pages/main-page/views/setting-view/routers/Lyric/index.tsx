import { IAppConfig } from "@/common/app-config/type";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import "./index.scss";
import ColorPickerSettingItem from "../../components/ColorPickerSettingItem";
import { ipcRendererInvoke, ipcRendererSend } from "@/common/ipc-util/renderer";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import FontPickerSettingItem from "../../components/FontPickerSettingItem";
import { IfTruthy } from "@/renderer/components/Condition";

interface IProps {
  data: IAppConfig["lyric"];
}

const numberArray = Array(65)
  .fill(0)
  .map((_, index) => 16 + index);

export default function Lyric(props: IProps) {
  const { data = {} as IAppConfig["lyric"] } = props;

  return (
    <div className="setting-view--lyric-container">
      <IfTruthy condition={window.globalData.platform === "darwin"}>
        <CheckBoxSettingItem
          label="启用状态栏歌词"
          checked={data.enableStatusBarLyric}
          keyPath="lyric.enableStatusBarLyric"
        ></CheckBoxSettingItem>
      </IfTruthy>
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
      <FontPickerSettingItem
        label="字体"
        keyPath="lyric.fontData"
        value={data.fontData}
      ></FontPickerSettingItem>
      <ListBoxSettingItem
        keyPath="lyric.fontSize"
        value={data.fontSize}
        options={numberArray}
        label="字体大小"
      ></ListBoxSettingItem>
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
    </div>
  );
}
