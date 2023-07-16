import { IAppConfig } from "@/common/app-config/type";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import rendererAppConfig from "@/common/app-config/renderer";

interface IProps {
  data: IAppConfig["theme"];
}

export default function Theme(props: IProps) {
  const { data = {} as IAppConfig["theme"] } = props;
  console.log(data);

  return (
    <div className="setting-view--normal-container">
      <div
        role="button"
        onClick={() => {
          window.themepack.selectTheme(null);
        }}
      >
        默认
      </div>
      {data.themePacks?.map((item) => (
        <div
          onClick={() => {
            window.themepack.selectTheme(item);
          }}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}
