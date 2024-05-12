import { IAppConfig } from "@/shared/app-config/type";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import MultiRadioGroupSettingItem from "../../components/MultiRadioGroupSettingItem";

interface IProps {
  data: IAppConfig["normal"];
}

export default function Normal(props: IProps) {
  const { data = {} as IAppConfig["normal"] } = props;

  return (
    <div className="setting-view--normal-container">
      <CheckBoxSettingItem
        label="应用启动时检测软件版本更新"
        checked={data.checkUpdate}
        keyPath="normal.checkUpdate"
      ></CheckBoxSettingItem>
      <RadioGroupSettingItem
        label="单击退出按钮时"
        keyPath="normal.closeBehavior"
        value={data.closeBehavior}
        options={[
          {
            value: "exit",
            title: "退出应用",
          },
          {
            value: "minimize",
            title: "最小化到托盘",
          },
        ]}
      ></RadioGroupSettingItem>
      {window.globalData.platform === "win32" ? (
        <RadioGroupSettingItem
          label="任务栏缩略图样式 (重启应用后生效)"
          keyPath="normal.taskbarThumb"
          value={data.taskbarThumb}
          options={[
            {
              value: "artwork",
              title: "当前播放歌曲的封面",
            },
            {
              value: "window",
              title: "主窗口界面",
            },
          ]}
        ></RadioGroupSettingItem>
      ) : null}
      <RadioGroupSettingItem
        label="搜索历史记录最多保存条数"
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
        label="歌曲列表隐藏列"
        keyPath="normal.musicListColumnsShown"
        value={data.musicListColumnsShown}
        options={[
          {
            title: "时长",
            value: "duration",
          },
          {
            title: "来源",
            value: "platform",
          },
        ]}
      ></MultiRadioGroupSettingItem>
    </div>
  );
}
