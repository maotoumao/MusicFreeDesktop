import { toast } from "react-toastify";
import SvgAsset from "@/renderer/components/SvgAsset";
import { ipcRendererInvoke } from "@/shared/ipc/renderer";
import { useTranslation } from "react-i18next";
import ThemePack from "@/shared/themepack/renderer";
import ThemeItem from "../ThemeItem";

import "./index.scss";

export default function LocalThemes() {
  const currentThemePack = ThemePack.useCurrentThemePack();
  const localThemePacks = ThemePack.useLocalThemePacks();

  const { t } = useTranslation();

  return (
    <div className="local-themes-container">
      <div className="local-themes-inner-container">
        <div className="theme-item-container">
          <div
            title={t("theme.install_theme")}
            className="theme-thumb-container theme-install-local"
            onClick={async () => {
              try {
                const result = await ipcRendererInvoke("show-open-dialog", {
                  title: t("theme.install_theme"),
                  buttonLabel: t("common.install"),
                  filters: [
                    {
                      name: t("theme.musicfree_theme"),
                      extensions: ["mftheme", "zip"],
                    },
                    {
                      name: t("theme.all_files"),
                      extensions: ["*"],
                    },
                  ],
                  properties: ["openFile", "multiSelections"],
                });

                if (!result.canceled) {
                  const themePackPaths = result.filePaths;
                  for (const themePackPath of themePackPaths) {
                    const themePackConfig = await ThemePack.installThemePack(
                      themePackPath
                    );
                    toast.success(
                      t("theme.install_theme_success", {
                        name: themePackConfig?.name
                          ? `「${themePackConfig.name}」`
                          : "",
                      })
                    );
                  }
                }
              } catch (e) {
                toast.warn(
                  t("theme.install_theme_fail", {
                    name: e?.message ? `「${e.message}」` : "",
                  })
                );
              }
            }}
          >
            <SvgAsset iconName="plus"></SvgAsset>
          </div>
        </div>

        {localThemePacks.map((it) => (
          <ThemeItem
            config={it}
            hash={it.hash}
            key={it.path}
            type="local"
            selected={it.hash === currentThemePack?.hash}
          ></ThemeItem>
        ))}
        <ThemeItem
          config={
            {
              name: t("common.default"),
              preview: "#f17d34",
            } as any
          }
          type="local"
          selected={!currentThemePack}
        ></ThemeItem>
      </div>
    </div>
  );
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
