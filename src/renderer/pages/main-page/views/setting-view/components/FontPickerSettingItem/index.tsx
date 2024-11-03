import {useMemo} from "react";
import ListBoxSettingItem from "../ListBoxSettingItem";
import {defaultFont as _defaultFont} from "@/common/constant";
import useLocalFonts from "@/hooks/useLocalFonts";
import {useTranslation} from "react-i18next";
import {IAppConfig} from "@/types/app-config";
import AppConfig from "@shared/app-config/renderer";

interface FontPickerSettingItemProps<T extends keyof IAppConfig> {
    keyPath: T;
    label?: string;
}

function useFonts() {
    const allLocalFonts = useLocalFonts();
    const {t} = useTranslation();

    const defaultFont = {
        ..._defaultFont,
        fullName: t("common.default"),
    };

    const fonts = useMemo(
        () => (allLocalFonts ? [defaultFont, ...allLocalFonts] : null),
        [allLocalFonts]
    );

    return fonts;
}

export default function FontPickerSettingItem<T extends keyof IAppConfig>(
    props: FontPickerSettingItemProps<T>
) {
    const {keyPath, label} = props;

    const fonts = useFonts();
    return (
        <ListBoxSettingItem
            label={label}
            keyPath={keyPath}
            renderItem={(item) => (item as FontData).fullName}
            options={fonts ?? (null as any)}
            onChange={(event, newValue) => {
                // 字体不可序列化 不知道为啥 json.stringify是空对象
                event.preventDefault();
                console.log(event.defaultPrevented, "Prev");
                AppConfig.setConfig({
                    [keyPath]: {
                        family: (newValue as FontData).family,
                        fullName: (newValue as FontData).fullName,
                        postscriptName: (newValue as FontData).postscriptName,
                        style: (newValue as FontData).style,
                    }
                });
            }}
        ></ListBoxSettingItem>
    );
}
