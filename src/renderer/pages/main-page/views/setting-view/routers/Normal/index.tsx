import { IAppConfig } from "@/common/app-config/type";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";

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
    </div>
  );
}
