import "./index.scss";
import { musicDetailShownStore } from "@renderer/components/MusicDetail/store";
import SvgAsset from "@renderer/components/SvgAsset";
import { useTranslation } from "react-i18next";
import { appUtil, appWindowUtil } from "@shared/utils/renderer";
import AppConfig from "@shared/app-config/renderer";

interface IProps {
}

export default function Header(props: IProps) {
    const { t } = useTranslation();


    return <div className='music-detail--header-container' >
        <div
          className="hide-music-detail"
          role="button"
          title={t("music_bar.close_music_detail_page")}
          onClick={() => {
            musicDetailShownStore.setValue(false);
          }}
        >
          <SvgAsset iconName="chevron-down"></SvgAsset>
        </div>
        <div className='music-detail--header-right'>
            <div
                role="button"
                title={t("app_header.minimize")}
                className="header-button"
                onClick={() => {
                    appWindowUtil.minMainWindow();
                }}
            >
                <SvgAsset iconName="minus"></SvgAsset>
            </div>
            <div role="button" className="header-button" onClick={() => {
                appWindowUtil.toggleMainWindowMaximize();
            }}>
                <SvgAsset iconName="square"></SvgAsset>
            </div>
            <div
                role="button"
                title={t("app_header.exit")}
                className="header-button"
                onClick={() => {
                    const exitBehavior = AppConfig.getConfig("normal.closeBehavior");
                    if (exitBehavior === "minimize") {
                        appWindowUtil.minMainWindow(true);
                    } else {
                        appUtil.exitApp();
                    }
                }}
            >
                <SvgAsset iconName="x-mark"></SvgAsset>
            </div>
        </div>
    </div>

}
