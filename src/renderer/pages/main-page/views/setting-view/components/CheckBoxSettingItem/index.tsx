import SvgAsset from "@/renderer/components/SvgAsset";
import classNames from "@/renderer/utils/classnames";
import {IAppConfig} from "@/types/app-config";
import useAppConfig from "@/hooks/useAppConfig";
import AppConfig from "@shared/app-config.new/renderer";

interface ICheckBoxSettingItemProps<T extends keyof IAppConfig> {
    keyPath: T;
    label?: string;
    onChange?: (event: Event, checked: boolean) => void;
}

export default function CheckBoxSettingItem<T extends keyof IAppConfig>(
    props: ICheckBoxSettingItemProps<T>
) {
    const {
        keyPath,
        label,
        onChange,
    } = props;

    const checked = useAppConfig(keyPath);

    return (
        <div className="setting-row">
            <div
                className={classNames({
                    "option-item-container": true,
                    highlight: checked as boolean,
                })}
                title={label}
                role="button"
                onClick={() => {
                    const event = new Event("ConfigChanged", {});
                    if (onChange) {
                        onChange(event, !checked);
                    }
                    if (!event.defaultPrevented) {
                        AppConfig.setConfig({
                            [keyPath]: !checked
                        })
                    }
                }}
            >
                <div className="checkbox">
                    {checked ? <SvgAsset iconName="check"></SvgAsset> : null}
                </div>
                {label}
            </div>
        </div>
    );
}
