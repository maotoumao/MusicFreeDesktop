import { setUserPreference } from "@/renderer/utils/user-perference";
import Base from "../Base";
import "./index.scss";
import { hideModal } from "../..";
import { useTranslation } from "react-i18next";
import { shellUtil } from "@shared/utils/renderer";

interface IUpdateProps {
  currentVersion: string;
  update: ICommon.IUpdateInfo["update"];
}
export default function Update(props: IUpdateProps) {
  const { currentVersion, update = {} as ICommon.IUpdateInfo["update"] } =
    props;

  const { t } = useTranslation();

  return (
    <Base withBlur defaultClose>
      <div className="modal--update-container shadow backdrop-color">
        <Base.Header>{t("modal.new_version_found")}</Base.Header>
        <div className="modal--body-container">
          <div className="version highlight">
            {t("modal.latest_version")}
            {update.version}
          </div>
          <div className="version">
            {t("modal.current_version")}
            {currentVersion}
          </div>
          <div className="divider"></div>
          {update.changeLog.map((item, index) => (
            <p key={index}>{item}</p>
          ))}
        </div>
        <div className="divider"></div>
        <div className="footer-options">
          <div
            role="button"
            data-type="normalButton"
            onClick={() => {
              setUserPreference("skipVersion", update.version);
              hideModal();
            }}
          >
            {t("modal.skip_this_version")}
          </div>
          <div
            role="button"
            data-type="primaryButton"
            onClick={() => {
              shellUtil.openExternal(update.download[0]);
            }}
          >
            {t("common.update")}
          </div>
        </div>
      </div>
    </Base>
  );
}
