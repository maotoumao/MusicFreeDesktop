import {Popover} from "@headlessui/react";
import "./index.scss";
import {useState} from "react";
import {HexAlphaColorPicker, HexColorInput} from "react-colorful";
import useAppConfig from "@/hooks/useAppConfig";
import {IAppConfig} from "@/types/app-config";
import AppConfig from "@/providers/app-config/renderer";

interface IColorPickerSettingItemProps<T extends keyof IAppConfig> {
    keyPath: T;
    label?: string;
}

export default function ColorPickerSettingItem<T extends keyof IAppConfig>(
    props: IColorPickerSettingItemProps<T>
) {
    const {keyPath, label} = props;
    const realColor = useAppConfig(keyPath);
    const [color, setColor] = useState<string>(realColor as string);

    return (
        <Popover className="setting-row">
            <div className="label-container">{label}</div>
            <div className="picker-container">
                <Popover.Button
                    as="div"
                    style={{
                        backgroundColor: realColor as string,
                    }}
                    className={"picker-swatch"}
                ></Popover.Button>
                <div>{realColor as string}</div>
            </div>
            <Popover.Panel className={"setting-colorpicker-panel shadow"}>
                {({close}) => {
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
                                        AppConfig.setConfig({
                                            [keyPath]: color as any
                                        });
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
