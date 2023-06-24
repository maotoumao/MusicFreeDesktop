import rendererAppConfig from "@/common/app-config/renderer";
import "./index.scss";

export default function SettingView() {
  const setting = rendererAppConfig.useAppConfig();
  console.log(setting);

  return <div>{JSON.stringify(setting)}
    <button onClick={() => {
      rendererAppConfig.setAppConfigPath('setting', 66)
    }}>cfg!!!</button>
  </div>;
}
