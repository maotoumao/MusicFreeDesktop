import AppConfig from "@shared/app-config/renderer";
import "./index.scss";
import {HTMLInputTypeAttribute, useState} from "react";
import {IAppConfig} from "@/types/app-config";
import useAppConfig from "@/hooks/useAppConfig";

interface InputSettingItemProps<T extends keyof IAppConfig> {
    keyPath: T;
    label?: string;
    onChange?: (event: Event, val: IAppConfig[T]) => void;
    width?: number | string;
    /** 是否过滤首尾空格 */
    trim?: boolean;
    disabled?: boolean;
    type?: HTMLInputTypeAttribute;
}

export default function InputSettingItem<T extends keyof IAppConfig>(
    props: InputSettingItemProps<T>
) {
    const {
        keyPath,
        label,
        onChange,
        width,
        type,
        disabled,
        trim
    } = props;

    const [tmpValue, setTmpValue] = useState<string | null>(null);
    const value = useAppConfig(keyPath);

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
                    const event = new Event("ConfigChanged");

                    if (onChange) {
                        onChange(event, tmpValue as any);
                    }

                    if (!event.defaultPrevented) {
                        AppConfig.setConfig({
                            [keyPath]: trim ? tmpValue.trim() as any : tmpValue as any
                        });
                    }
                    setTmpValue(null);
                }}
                value={(tmpValue || value || "") as string}
            ></input>
        </div>
    );
}
