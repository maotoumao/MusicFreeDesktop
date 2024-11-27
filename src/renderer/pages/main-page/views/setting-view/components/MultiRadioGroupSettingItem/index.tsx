import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";
import classNames from "@/renderer/utils/classnames";
import {IAppConfig} from "@/types/app-config";
import useAppConfig from "@/hooks/useAppConfig";
import AppConfig from "@/providers/app-config/renderer";

type ExtractArrayItem<T> = T extends Array<infer R> ? R : never;

interface IRadioGroupSettingItemProps<T extends keyof IAppConfig> {
    keyPath: T;
    label?: string;
    options: IAppConfig[T];
    renderItem?: (item: ExtractArrayItem<IAppConfig[T]>) => string;
    direction?: "horizontal" | "vertical";
}

/**
 * 多选
 * @param props
 * @constructor
 */
export default function MultiRadioGroupSettingItem<T extends keyof IAppConfig>(
    props: IRadioGroupSettingItemProps<T>
) {
    const {
        keyPath,
        label,
        options,
        renderItem,
        direction = "horizontal",
    } = props;
    const value = useAppConfig(keyPath);


    return (
        <div className="setting-view--radio-group-setting-item-container setting-row">
            <div className={"label-container"}>{label}</div>
            <div
                className="options-container"
                style={{
                    flexDirection: direction === "horizontal" ? "row" : "column",
                }}
            >
                {(options as any[]).map((option, index) => {
                    const checked = (value as Array<any>)?.includes(option);
                    const title = renderItem ? renderItem(option) : (option as string);

                    return (
                        <div
                            className={classNames({
                                "option-item-container": true,
                                highlight: checked,
                            })}
                            title={title}
                            key={index}
                            onClick={() => {
                                let newValue = [];
                                if (checked) {
                                    newValue = (value as Array<any>)?.filter(
                                        (it) => it !== option
                                    ) ?? []

                                } else {
                                    newValue = [...(value as Array<any> || []), option];

                                }
                                AppConfig.setConfig({
                                    [keyPath]: newValue
                                })
                            }}
                        >
                            <div className="checkbox">
                                {checked ? <SvgAsset iconName="check"></SvgAsset> : null}
                            </div>
                            {title}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
