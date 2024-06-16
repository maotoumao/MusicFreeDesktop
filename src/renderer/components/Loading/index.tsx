import { useTranslation } from "react-i18next";
import "./index.scss";

interface ILoadingProps {
  text?: string
}
export default function Loading(props: ILoadingProps) {
  const {t} = useTranslation();

  return (
    <div className="loading-container">
      <div className="spinner-container">
        <div></div>
        <div></div>
        <div></div>
      </div>
      <span>{props.text ?? t("common.loading")}</span>
    </div>
  );
}
