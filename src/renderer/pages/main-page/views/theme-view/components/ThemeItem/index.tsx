import { useTranslation } from "react-i18next";
import "./index.scss";
import { If, IfTruthy } from "@/renderer/components/Condition";
import { useState } from "react";
import Themepack from "@/shared/themepack/renderer";
import { toast } from "react-toastify";
import Loading from "@/renderer/components/Loading";

interface IProps {
  config: ICommon.IThemePack;
  hash?: string;
  type: "remote" | "local";
  selected?: boolean;
  /**[Remote Only] 主题的最新版是否已经在本地安装 */
  latestInstalled?: boolean;
  /**[Remote Only] 主题是否已经在本地安装 */
  installed?: boolean;
}

export default function ThemeItem(props: IProps) {
  const { config, type, selected, latestInstalled, installed, hash } = props;

  const [isHover, setIsHover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { t } = useTranslation();

  const selectTheme = async () => {
    try {
      if (type === "local") {
        await Themepack.selectTheme(config);
      } else {
        if (latestInstalled) {
          await Themepack.selectThemeByHash(hash);
        } else {
          setIsLoading(true);
          const themePack = await Themepack.installRemoteThemePack(
            config.srcUrl,
            config.id
          );
          await Themepack.selectTheme(themePack);
        }
      }
    } catch (e) {
      toast.error(
        t("theme.invalid_theme", {
          reason: e?.message ?? "",
        })
      );
    }
    setIsLoading(false);
  };

  return (
    <div
      className="theme-item-container"
      onMouseEnter={() => {
        setIsHover(true);
      }}
      onMouseLeave={() => {
        setIsHover(false);
      }}
    >
      <div className="theme-thumb-container">
        {config.preview?.startsWith("#") ? (
          <div
            className="theme-thumb"
            style={{
              backgroundColor: config.preview,
            }}
          ></div>
        ) : (
          <img src={config.preview} className="theme-thumb"></img>
        )}
        <IfTruthy condition={selected}>
          <div className="theme-selected"></div>
        </IfTruthy>
        <div className="theme-options-mask" data-show={isHover || isLoading}>
          {isLoading ? (
            <div className="theme-downloading">
              <Loading text={t("common.downloading")}></Loading>
            </div>
          ) : (
            <If condition={type === "remote"}>
              <If.Truthy>
                <div
                  className="theme-option-button"
                  role="button"
                  onClick={selectTheme}
                >
                  {latestInstalled
                    ? t("theme.use_theme")
                    : installed
                    ? t("theme.update_theme")
                    : t("theme.download_and_use")}
                </div>
              </If.Truthy>
              <If.Falsy>
                <div
                  className="theme-option-button"
                  role="button"
                  onClick={selectTheme}
                >
                  {t("theme.use_theme")}
                </div>
                {hash && (
                  <div
                    className="theme-option-button"
                    role="button"
                    onClick={() => {
                      Themepack.uninstallThemePack(config);
                    }}
                  >
                    {t("common.uninstall")}
                  </div>
                )}
              </If.Falsy>
            </If>
          )}
        </div>
      </div>

      <div
        className="theme-name"
        title={config.description || config.name}
        onClick={selectTheme}
      >
        {config.name}
      </div>
      <IfTruthy condition={config.author}>
        <div className="theme-author">
          {t("media.media_type_artist")}: {config.author}
        </div>
      </IfTruthy>
    </div>
  );
}
