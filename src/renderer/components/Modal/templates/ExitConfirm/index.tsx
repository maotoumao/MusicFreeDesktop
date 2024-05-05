import { useTranslation } from "react-i18next";
import Base from "../Base";
import "./index.scss";

export default function ExitConfirm() {
  const {t} = useTranslation();

  return (
    <Base withBlur>
      <div className="modal--exit-confirm-container shadow backdrop-color">
        {t("modal.exit_confirm")}
      </div>
    </Base>
  );
}
