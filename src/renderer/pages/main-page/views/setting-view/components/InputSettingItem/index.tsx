import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/shared/app-config/type";
import "./index.scss";
import defaultAppConfig from "@/shared/app-config/internal/default-app-config";
import { HTMLInputTypeAttribute, useState } from "react";
import { setAppConfigPath } from "@/shared/app-config/renderer";

interface InputSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  value?: IAppConfigKeyPathValue<T>;
  onChange?: (val: IAppConfigKeyPathValue<T>) => void;
  width?: number | string;
  /** 是否过滤首尾空格 */
  trim?: boolean;
  disabled?: boolean;
  type?: HTMLInputTypeAttribute;
}

export default function InputSettingItem<T extends IAppConfigKeyPath>(
  props: InputSettingItemProps<T>
) {
  const {
    keyPath,
    label,
    value = defaultAppConfig[keyPath],
    onChange,
    width,
    type,
    disabled,
  } = props;

  const [tmpValue, setTmpValue] = useState<string | null>(null);

  return (
    <div
      className="setting-view--input-setting-item-container"
      style={{
        width,
      }}
    >
      {label ? <div className="input-label">{label}</div> : null}
      <input
        disabled={disabled}
        spellCheck={false}
        onChange={(e) => {
          setTmpValue(e.target.value ?? null);
        }}
        type={type}
        onBlur={() => {
          if (tmpValue === null) {
            return;
          }
          if (onChange) {
            onChange(tmpValue as any);
          } else {
            setAppConfigPath(keyPath, tmpValue.trim() as any);
          }
          setTmpValue(null);
        }}
        value={(tmpValue || value || "") as string}
      ></input>
    </div>
  );
}
