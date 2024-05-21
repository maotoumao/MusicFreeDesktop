import defaultAppConfig from "@/shared/app-config/internal/default-app-config";
import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/shared/app-config/type";

import { Popover } from "@headlessui/react";
import "./index.scss";
import { useRef, useState } from "react";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";
import { setAppConfigPath } from "@/shared/app-config/renderer";

interface IColorPickerSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  value?: IAppConfigKeyPathValue<T>;
}

export default function ColorPickerSettingItem<T extends IAppConfigKeyPath>(
  props: IColorPickerSettingItemProps<T>
) {
  const { keyPath, label, value = defaultAppConfig[keyPath] } = props;
  const [color, setColor] = useState<string>(value as string);

  return (
    <Popover className="setting-row">
      <div className="label-container">{label}</div>
      <div className="picker-container">
        <Popover.Button
          as="div"
          style={{
            backgroundColor: value as string,
          }}
          className={"picker-swatch"}
        ></Popover.Button>
        <div>{value as string}</div>
      </div>
      <Popover.Panel className={"setting-colorpicker-panel shadow"}>
        {({ close }) => {
          return (
            <>
              <HexAlphaColorPicker
                color={color}
                onChange={setColor}
              ></HexAlphaColorPicker>
              <div className="setting-colorpicker-options">
                <HexColorInput
                  color={color}
                  onChange={setColor}
                  alpha
                  prefixed
                  placeholder="选择一个颜色"
                ></HexColorInput>
                <div
                  role="button"
                  onClick={() => {
                    setAppConfigPath(keyPath, color as any);
                    close();
                  }}
                >
                  提交
                </div>
              </div>
            </>
          );
        }}
      </Popover.Panel>
    </Popover>
    // <div
    //   className="setting-row"
    //   role="button"
    //   onClick={() => {
    //     setAppConfigPath(keyPath, !checked as any);
    //   }}
    // >
    //   <div
    //     className={classNames({
    //       "option-item-container": true,
    //       highlight: checked as boolean,
    //     })}
    //     title={label}
    //   >
    //     <div className="checkbox">
    //       {checked ? <SvgAsset iconName="check"></SvgAsset> : null}
    //     </div>
    //     {label}
    //   </div>
    // </div>
  );
}
