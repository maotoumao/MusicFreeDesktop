import rendererAppConfig from "@/common/app-config/renderer";
import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/common/app-config/type";
import { Listbox } from "@headlessui/react";
import "./index.scss";
import defaultAppConfig from "@/common/app-config/default-app-config";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import { isBasicType } from "@/common/normalize-util";
import useVirtualList from "@/renderer/hooks/useVirtualList";
import { rem } from "@/common/constant";
import {
  Fragment,
  HTMLInputTypeAttribute,
  useEffect,
  useRef,
  useState,
} from "react";

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
            rendererAppConfig.setAppConfigPath(keyPath, tmpValue.trim() as any);
          }
          setTmpValue(null);
        }}
        value={(tmpValue || value || "") as string}
      ></input>
    </div>
  );
}
