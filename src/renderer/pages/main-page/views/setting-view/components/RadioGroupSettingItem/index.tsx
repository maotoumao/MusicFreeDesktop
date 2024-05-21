import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/shared/app-config/type";
import { RadioGroup } from "@headlessui/react";
import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";
import classNames from "@/renderer/utils/classnames";
import defaultAppConfig from "@/shared/app-config/internal/default-app-config";
import { setAppConfigPath } from "@/shared/app-config/renderer";

interface IRadioGroupSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  options: Array<{
    /** 存储的value */
    value: IAppConfigKeyPathValue<T>;
    /** 展示的值 */
    title?: string;
  }>;
  value?: IAppConfigKeyPathValue<T>;
  direction?: "horizonal" | "vertical";
}

export default function RadioGroupSettingItem<T extends IAppConfigKeyPath>(
  props: IRadioGroupSettingItemProps<T>
) {
  const {
    keyPath,
    label,
    options,
    value = defaultAppConfig[keyPath],
    direction = "horizonal",
  } = props;
  return (
    <div className="setting-view--radio-group-setting-item-container setting-row">
      <RadioGroup
        value={value}
        onChange={(val) => {
          setAppConfigPath(keyPath, val);
        }}
      >
        <RadioGroup.Label className={"label-container"}>
          {label}
        </RadioGroup.Label>
        <div
          className="options-container"
          style={{
            flexDirection: direction === "horizonal" ? "row" : "column",
          }}
        >
          {options.map((option, index) => (
            <RadioGroup.Option key={index} value={option.value}>
              {({ checked }) => {
                return (
                  <div
                    className={classNames({
                      "option-item-container": true,
                      highlight: checked,
                    })}
                    title={option.title}
                  >
                    <div className="checkbox">
                      {checked ? <SvgAsset iconName="check"></SvgAsset> : null}
                    </div>
                    {option.title ?? (option.value as string)}
                  </div>
                );
              }}
            </RadioGroup.Option>
          ))}
        </div>
      </RadioGroup>
    </div>
  );
}
