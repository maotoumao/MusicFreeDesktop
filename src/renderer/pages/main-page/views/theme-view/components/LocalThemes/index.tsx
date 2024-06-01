import { IAppConfig } from "@/shared/app-config/type";
import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import { useEffect, useState } from "react";
import {
  IContextMenuItem,
  showContextMenu,
} from "@/renderer/components/ContextMenu";
import { toast } from "react-toastify";
import SvgAsset from "@/renderer/components/SvgAsset";
import { ipcRendererInvoke } from "@/shared/ipc/renderer";
import A from "@/renderer/components/A";
import { Trans, useTranslation } from "react-i18next";
import { i18n } from "@/shared/i18n/renderer";
import Themepack from "@/shared/themepack/renderer";
import ThemeItem from "../ThemeItem";

const allThemePacksStore = Themepack.allThemePacksStore;
const currentThemePackStore = Themepack.currentThemePackStore;

export default function LocalThemes() {
  const [currentThemePack, setCurrentThemePack] = useState<ICommon.IThemePack>(
    currentThemePackStore.getValue()
  );
  const [allThemePacks, setAllThemePacks] = useState<
    Array<ICommon.IThemePack | null>
  >(allThemePacksStore.getValue());

  const { t } = useTranslation();

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
    <div className="local-themes-container">
      <div className="local-themes-inner-container">
        {allThemePacks.map((it) => (
          <ThemeItem config={it} key={it.path} type="local"></ThemeItem>
        ))}
      </div>
    </div>
  );
}

interface IThemeItemProps {
  selected: boolean;
  themePack: ICommon.IThemePack | null;
}

export function showThemeContextMenu(
  themePack: ICommon.IThemePack,
  x: number,
  y: number
) {
  const menuItems: IContextMenuItem[] = [];

  const { t } = i18n;
  menuItems.push(
    // {
    //   title: "刷新主题",
    //   icon: "motion-play",
    //   onClick() {
    //     trackPlayer.addNext(musicItems);
    //   },
    // },
    {
      title: t("settings.theme.uninstall_theme"),
      icon: "trash",
      async onClick() {
        const [code, reason] = await Themepack.uninstallThemePack(themePack);

        if (code) {
          toast.success(
            t("settings.theme.uninstall_theme_success", {
              name: themePack?.name ? `「${themePack.name}」` : "",
            })
          );
        } else {
          toast.error(
            t("settings.theme.uninstall_theme_fail", {
              reason: reason?.message ?? "",
            })
          );
        }
      },
    }
  );

  showContextMenu({
    x,
    y,
    menuItems,
  });
}

// function ThemeItem(props: IThemeItemProps) {
//   const { selected, themePack } = props;

//   const { t } = useTranslation();

//   return (
//     <div
//       className="theme-item-container"
//       role="button"
//       onClick={() => {
//         Themepack.selectTheme(themePack);
//       }}
//       onContextMenu={(e) => {
//         if (!themePack) {
//           return;
//         }
//         showThemeContextMenu(themePack, e.clientX, e.clientY);
//       }}
//       title={themePack?.description}
//     >
//       <div
//         className={classNames({
//           "theme-item-preview": true,
//           "theme-item-preview-selected": selected,
//         })}
//         style={{
//           background:
//             themePack === null
//               ? "#f17d34"
//               : themePack.preview.startsWith("#")
//               ? themePack.preview
//               : `center/cover no-repeat url(${themePack.preview})`,
//         }}
//       ></div>
//       <div className="theme-item-title">
//         {themePack ? themePack.name : t("common.default")}
//       </div>
//     </div>
//   );
// }
