import {RadioGroup} from "@headlessui/react";
import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";
import classNames from "@/renderer/utils/classnames";
import {IAppConfig} from "@/types/app-config";
import useAppConfig from "@/hooks/useAppConfig";
import AppConfig from "@shared/app-config.new/renderer";


interface IRadioGroupSettingItemProps<T extends keyof IAppConfig> {
    keyPath: T;
    label?: string;
    options: Array<IAppConfig[T]>
    renderItem?: (item: IAppConfig[T]) => string;
    direction?: "horizontal" | "vertical";
}

export default function RadioGroupSettingItem<T extends keyof IAppConfig>(
    props: IRadioGroupSettingItemProps<T>
) {
    const {
        keyPath,
        label,
        options,
        direction = "horizontal",
        renderItem
    } = props;

    const value = useAppConfig(keyPath);

    return (
        <div className="setting-view--radio-group-setting-item-container setting-row">
            <RadioGroup
                value={value}
                onChange={(val) => {
                    AppConfig.setConfig({
                        [keyPath]: val
                    })
                }}
            >
                <RadioGroup.Label className={"label-container"}>
                    {label}
                </RadioGroup.Label>
                <div
                    className="options-container"
                    style={{
                        flexDirection: direction === "horizontal" ? "row" : "column",
                    }}
                >
                    {options.map((option, index) => (
                        <RadioGroup.Option key={index} value={option}>
                            {({checked}) => {
                                const title = renderItem ? renderItem(option) : option as string;
                                return (
                                    <div
                                        className={classNames({
                                            "option-item-container": true,
                                            highlight: checked,
                                        })}
                                        title={title}
                                    >
                                        <div className="checkbox">
                                            {checked ? <SvgAsset iconName="check"></SvgAsset> : null}
                                        </div>
                                        {title}
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
