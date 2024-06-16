import A from "@/renderer/components/A";
import wxChannelImg from "@/assets/imgs/wechat_channel1.png";
import checkUpdate from "@/renderer/utils/check-update";
import { toast } from "react-toastify";
import "./index.scss";
import { Trans, useTranslation } from "react-i18next";
import { getGlobalContext } from "@/shared/global-context/renderer";

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="setting-view--about-container">
      <div className="setting-row about-version">
        <Trans
          i18nKey={"settings.about.current_version"}
          values={{
            version: getGlobalContext().appVersion,
          }}
        ></Trans>
        <A
          onClick={async () => {
            const needUpdate = await checkUpdate(true);
            if (!needUpdate) {
              toast.success(t("settings.about.already_latest"));
            }
          }}
        >
          {t("settings.about.check_update")}
        </A>
      </div>

      <div className="setting-row about-version">
        {t("settings.about.software_author")}{" "}
        <A href="https://github.com/maotoumao">Github@猫头猫</A>
        <A href="https://space.bilibili.com/12866223">
          bilibili@不想睡觉猫头猫
        </A>
        <A href="https://twitter.com/upupfun">X@upupfun</A>
      </div>
      <img className="wx-channel" src={wxChannelImg}></img>

      <div className="setting-row about-version">
        <Trans
          i18nKey="settings.about.open_source_declaration"
          components={{
            Github: (
              <A href="https://github.com/maotoumao/MusicFreeDesktop"></A>
            ),
            Gitee: <A href="https://gitee.com/maotoumao/MusicFreeDesktop"></A>,
          }}
        ></Trans>
      </div>
      <div className="setting-row about-version">
        <A href="http://musicfree.upup.fun/">
          {t("settings.about.official_site")}
        </A>
        <A href="https://github.com/maotoumao/MusicFree">
          {t("settings.about.mobile_version")}
        </A>
      </div>
    </div>
  );
}
