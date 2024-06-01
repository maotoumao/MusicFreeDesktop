import { useTranslation } from "react-i18next";
import "./index.scss";
import { If, IfTruthy } from "@/renderer/components/Condition";
import { useState } from "react";
import Themepack from "@/shared/themepack/renderer";
import { toast } from "react-toastify";

interface IProps {
  config: ICommon.IThemePack;
  type: "remote" | "local";
}

export default function ThemeItem(props: IProps) {
  const { config, type } = props;

  const [isHover, setIsHover] = useState(false);

  const { t } = useTranslation();

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
        {config.preview.startsWith("#") ? (
          <div
            className="theme-thumb"
            style={{
              backgroundColor: config.preview,
            }}
          ></div>
        ) : (
          <img src={config.preview} className="theme-thumb"></img>
        )}
        <div className="theme-options-mask" data-hover={isHover}>
          <If condition={type === "remote"}>
            <If.Truthy>
              <div
                className="theme-option-button"
                role="button"
                onClick={async () => {
                  try {
                    await Themepack.installRemoteThemePack(config.srcUrl);
                    // await Themepack.selectTheme()
                    toast.success(
                      t("theme.install_theme_success", {
                        name: config.name,
                      })
                    );
                  } catch (e) {
                    toast.error(
                      t("theme.install_theme_fail", {
                        reason: e?.message ?? "",
                      })
                    );
                  }
                }}
              >
                {t("theme.download_and_use")}
              </div>
            </If.Truthy>
            <If.Falsy>
              <div
                className="theme-option-button"
                role="button"
                onClick={() => {
                  Themepack.selectTheme(config);
                }}
              >
                {t("theme.use_theme")}
              </div>
              <div
                className="theme-option-button"
                role="button"
                onClick={() => {
                  Themepack.uninstallThemePack(config);
                }}
              >
                {t("common.uninstall")}
              </div>
            </If.Falsy>
          </If>
        </div>
      </div>

      <div className="theme-name" title={config.description || config.name}>
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
