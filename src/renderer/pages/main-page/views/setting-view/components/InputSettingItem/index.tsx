// src/renderer/pages/main-page/views/setting-view/components/InputSettingItem/index.tsx
import AppConfig from "@shared/app-config/renderer";
import "./index.scss";
import {HTMLInputTypeAttribute, useState, useEffect} from "react"; // 确保 useEffect 被导入
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

    const configValue = useAppConfig(keyPath);
    const [tmpValue, setTmpValue] = useState<string>(((configValue as unknown) as string) || "");

    useEffect(() => {
        setTmpValue(((configValue as unknown) as string) || "");
    }, [configValue]);


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
                value={tmpValue} 
                onChange={(e) => {
                    setTmpValue(e.target.value ?? ""); 
                }}
                type={type || 'text'}
                onBlur={() => {
                    const event = new Event("ConfigChanged", {
                        cancelable: true
                    });

                    const valueToSet = trim && tmpValue ? tmpValue.trim() : tmpValue;

                    if (onChange) {
                        onChange(event, valueToSet as any);
                    }

                    if (!event.defaultPrevented) {
                        AppConfig.setConfig({
                            [keyPath]: valueToSet as any
                        });
                    }
                }}
            ></input>
        </div>
    );
}