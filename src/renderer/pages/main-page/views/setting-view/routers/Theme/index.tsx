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

interface IProps {
  data: IAppConfig["theme"];
}

export default function Theme(props: IProps) {
  const allThemePacksStore = window.themepack.allThemePacksStore;
  const currentThemePackStore = window.themepack.currentThemePackStore;
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
    <div className="setting-view--theme-container">
      <div className="setting-row">
        💡{t("settings.theme.example_theme_hint")}
        <A href="https://github.com/maotoumao/MusicFreeThemePacks">
          https://github.com/maotoumao/MusicFreeThemePacks
        </A>
      </div>
      <div className="setting-row">
        ⭐
        <Trans
          i18nKey={"settings.theme.example_theme_subscription_hint"}
          components={{
            highlight: <span className="highlight"></span>,
          }}
        ></Trans>
      </div>
      <div className="setting-view--theme-items">
        <ThemeItem
          selected={currentThemePack === null}
          themePack={null}
        ></ThemeItem>
        {allThemePacks?.map((item) => (
          <ThemeItem
            key={item.path}
            themePack={item}
            selected={item.path === currentThemePack?.path}
          ></ThemeItem>
        ))}
        <div
          className="theme-item-container"
          role="button"
          title={t("settings.theme.install_theme")}
          onClick={async () => {
            const result = await ipcRendererInvoke("show-open-dialog", {
              title: t("settings.theme.install_theme"),
              buttonLabel: t("common.install"),
              filters: [
                {
                  name: t("settings.theme.musicfree_theme"),
                  extensions: ["mftheme", "zip"],
                },
                {
                  name: t("settings.theme.all_files"),
                  extensions: ["*"],
                },
              ],
              properties: ["openFile", "multiSelections"],
            });
            console.log(result);
            if (!result.canceled) {
              const themePackPaths = result.filePaths;
              for (const themePackPath of themePackPaths) {
                const [code, reason] = await window.themepack.installThemePack(
                  themePackPath
                );
                if (code) {
                  toast.success(
                    t("settings.theme.install_theme_success", {
                      name: reason?.name ? `「${reason.name}」` : "",
                    })
                  );
                } else {
                  t("settings.theme.install_theme_fail", {
                    reason: reason?.message,
                  });
                }
              }
            }
          }}
        >
          <div className="theme-item-preview install-theme-pack">
            <SvgAsset iconName="plus"></SvgAsset>
          </div>
        </div>
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
        const [code, reason] = await window.themepack.uninstallThemePack(
          themePack
        );

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

function ThemeItem(props: IThemeItemProps) {
  const { selected, themePack } = props;

  const { t } = useTranslation();

  return (
    <div
      className="theme-item-container"
      role="button"
      onClick={() => {
        window.themepack.selectTheme(themePack);
      }}
      onContextMenu={(e) => {
        if (!themePack) {
          return;
        }
        showThemeContextMenu(themePack, e.clientX, e.clientY);
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
        {themePack ? themePack.name : t("common.default")}
      </div>
    </div>
  );
}
