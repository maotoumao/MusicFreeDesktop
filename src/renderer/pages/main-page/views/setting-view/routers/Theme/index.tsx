import { IAppConfig, IThemePack } from "@/common/app-config/type";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import rendererAppConfig from "@/common/app-config/renderer";
import classNames from "@/renderer/utils/classnames";
import { useEffect, useState } from "react";

interface IProps {
  data: IAppConfig["theme"];
}

export default function Theme(props: IProps) {
  // const { data = {} as IAppConfig["theme"] } = props;
  // console.log(data);
  const allThemePacksStore = window.themepack.allThemePacksStore;
  const currentThemePackStore = window.themepack.currentThemePackStore;
  const [currentThemePack, setCurrentThemePack] = useState<ICommon.IThemePack>(
    currentThemePackStore.getValue()
  );
  const [allThemePacks, setAllThemePacks] = useState<
    Array<ICommon.IThemePack | null>
  >(allThemePacksStore.getValue());

  useEffect(() => {
    const unsub1 = allThemePacksStore.onValueChange((newValue) => {
      setAllThemePacks(newValue);
    });
    const unsub2 = currentThemePackStore.onValueChange((newValue) => {
      setCurrentThemePack(newValue);
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  return (
    <div className="setting-view--theme-container">
      <div className="setting-view--theme-items">
        <ThemeItem
          selected={currentThemePack === null}
          themePack={null}
        ></ThemeItem>
        {allThemePacks?.map((item) => (
          <ThemeItem
            themePack={item}
            selected={item.path === currentThemePack?.path}
          ></ThemeItem>
        ))}
      </div>
    </div>
  );
}

interface IThemeItemProps {
  selected: boolean;
  themePack: IThemePack | null;
}

function ThemeItem(props: IThemeItemProps) {
  const { selected, themePack } = props;
  return (
    <div
      className="theme-item-container"
      role="button"
      onClick={() => {
        window.themepack.selectTheme(themePack);
      }}
      title={themePack?.description}
    >
      <div
        className={classNames({
          "theme-item-preview": true,
          "theme-item-preview-selected": selected,
        })}
        style={{
          background:
            themePack === null
              ? "#f17d34"
              : themePack.preview.startsWith("#")
              ? themePack.preview
              : `center/cover no-repeat url(${themePack.preview})`,
        }}
      ></div>
      <div className="theme-item-title">
        {themePack ? themePack.name : "默认"}
      </div>
    </div>
  );
}
