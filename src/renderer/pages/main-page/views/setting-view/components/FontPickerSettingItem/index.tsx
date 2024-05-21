import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/shared/app-config/type";
import defaultAppConfig from "@/shared/app-config/internal/default-app-config";
import { useEffect, useMemo, useState } from "react";
import ListBoxSettingItem from "../ListBoxSettingItem";
import { defaultFont as _defaultFont } from "@/common/constant";
import useLocalFonts from "@/renderer/hooks/useLocalFonts";
import { setAppConfigPath } from "@/shared/app-config/renderer";
import { useTranslation } from "react-i18next";

interface FontPickerSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  value?: IAppConfigKeyPathValue<T>;
}

function useFonts() {
  const allLocalFonts = useLocalFonts();
  const { t } = useTranslation();

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

export default function FontPickerSettingItem<T extends IAppConfigKeyPath>(
  props: FontPickerSettingItemProps<T>
) {
  const { keyPath, label, value = defaultAppConfig[keyPath] } = props;

  const fonts = useFonts();
  return (
    <ListBoxSettingItem
      label={label}
      keyPath={keyPath}
      value={value}
      renderItem={(item) => (item as FontData).fullName}
      options={fonts ?? (null as any)}
      onChange={(val) => {
        // 字体不可序列化 不知道为啥 json.stringify是空对象
        setAppConfigPath(keyPath, {
          family: (val as FontData).family,
          fullName: (val as FontData).fullName,
          postscriptName: (val as FontData).postscriptName,
          style: (val as FontData).style,
        } as any);
      }}
    ></ListBoxSettingItem>
  );
}
