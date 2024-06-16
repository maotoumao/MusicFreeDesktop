import { CSSProperties } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";

interface IEmptyProps {
  style?: CSSProperties;
}

export default function Empty(props: IEmptyProps) {
  const { style } = props;
  const {t} = useTranslation();

  return (
    <div className="components--empty-container" style={style}>
      {t("empty.hint_empty")}
    </div>
  );
}
