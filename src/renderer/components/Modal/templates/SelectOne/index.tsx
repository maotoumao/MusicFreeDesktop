import { useState } from "react";
import { hideModal } from "../..";
import Base from "../Base";
import "./index.scss";
import Condition from "@/renderer/components/Condition";
import classNames from "@/renderer/utils/classnames";
import SvgAsset from "@/renderer/components/SvgAsset";
import { useTranslation } from "react-i18next";

interface IProps {
  title: string;
  choices: Array<{
    label?: string;
    value: any;
  }>;
  extra?: string; // 附加字段
  onOk?: (value: any, extra?: boolean) => void;
  defaultValue?: any;
  defaultExtra?: boolean;
}

export default function SelectOne(props: IProps) {
  const { title, choices, onOk, defaultValue, extra, defaultExtra } = props;
  const [selectedIndex, setSelectedIndex] = useState<number>(
    defaultValue !== undefined
      ? choices.findIndex((choice) => choice.value === defaultValue)
      : -1
  );
  const [extraChecked, setExtraChecked] = useState(defaultExtra ?? false);
  const { t } = useTranslation();

  return (
    <Base defaultClose withBlur={false}>
      <div className="modal--select-one-container shadow backdrop-color">
        <Base.Header>{title}</Base.Header>
        <div className="modal--body-container">
          {choices.map((choice, index) => (
            <div
              className="row-container"
              key={choice.value}
              role="button"
              data-selected={selectedIndex === index}
              onClick={() => {
                setSelectedIndex(index);
              }}
            >
              {choice.label ?? choice.value}
            </div>
          ))}
        </div>
        <div className="footer-options">
          <Condition condition={extra}>
            <div
              className={classNames({
                "footer-extra": true,
                highlight: extraChecked,
              })}
              role="button"
              onClick={() => {
                setExtraChecked((prev) => !prev);
              }}
            >
              <div className="checkbox">
                <Condition condition={extraChecked}>
                  <SvgAsset iconName="check"></SvgAsset>
                </Condition>
              </div>
              {extra}
            </div>
          </Condition>
          <div
            role="button"
            data-type="normalButton"
            onClick={() => {
              hideModal();
            }}
          >
            {t("common.cancel")}
          </div>
          <div
            role="button"
            data-type="primaryButton"
            data-disabled={selectedIndex === -1}
            onClick={async () => {
              onOk?.(choices[selectedIndex]?.value, extraChecked);
              hideModal();
            }}
          >
            {t("common.confirm")}
          </div>
        </div>
      </div>
    </Base>
  );
}
