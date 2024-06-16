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

type Extract<T> = T extends Array<infer R> ? R : never;

interface IRadioGroupSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  options: Array<{
    /** 存储的value */
    value: Extract<IAppConfigKeyPathValue<T>>;
    /** 展示的值 */
    title?: string;
  }>;
  value?: IAppConfigKeyPathValue<T>;
  direction?: "horizonal" | "vertical";
}

export default function MultiRadioGroupSettingItem<T extends IAppConfigKeyPath>(
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
      <div className={"label-container"}>{label}</div>
      <div
        className="options-container"
        style={{
          flexDirection: direction === "horizonal" ? "row" : "column",
        }}
      >
        {options.map((option, index) => {
          const checked = (value as Array<any>).includes(option.value);
          console.log(option, checked);

          return (
            <div
              className={classNames({
                "option-item-container": true,
                highlight: checked,
              })}
              title={option.title}
              key={index}
              onClick={() => {
                if (checked) {
                  setAppConfigPath(
                    "normal.musicListColumnsShown",
                    (value as Array<any>)?.filter(
                      (it) => it !== option.value
                    ) ?? []
                  );
                } else {
                  setAppConfigPath("normal.musicListColumnsShown", [
                    ...((value as Array<any>) ?? []),
                    option.value,
                  ]);
                }
              }}
            >
              <div className="checkbox">
                {checked ? <SvgAsset iconName="check"></SvgAsset> : null}
              </div>
              {option.title ?? (option.value as string)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
