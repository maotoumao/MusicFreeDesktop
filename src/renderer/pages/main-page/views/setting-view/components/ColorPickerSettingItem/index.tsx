import defaultAppConfig from "@/common/app-config/default-app-config";
import rendererAppConfig from "@/common/app-config/renderer";
import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/common/app-config/type";

import { Popover } from "@headlessui/react";
import "./index.scss";
import { useRef, useState } from "react";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";

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
            backgroundColor: color,
          }}
          className={"picker-swatch"}
        ></Popover.Button>
        <div>{color}</div>
      </div>
      <Popover.Panel className={"setting-colorpicker-panel"}>
        <HexAlphaColorPicker
          color={color}
          onChange={setColor}
        ></HexAlphaColorPicker>
        <HexColorInput color={color} onChange={setColor} alpha prefixed placeholder="选择一个颜色"></HexColorInput>
      </Popover.Panel>
    </Popover>
    // <div
    //   className="setting-row"
    //   role="button"
    //   onClick={() => {
    //     rendererAppConfig.setAppConfigPath(keyPath, !checked as any);
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
