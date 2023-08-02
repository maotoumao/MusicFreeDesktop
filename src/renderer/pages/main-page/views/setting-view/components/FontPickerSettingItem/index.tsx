import rendererAppConfig from "@/common/app-config/renderer";
import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/common/app-config/type";
import defaultAppConfig from "@/common/app-config/default-app-config";
import { useEffect, useState } from "react";
import ListBoxSettingItem from "../ListBoxSettingItem";
import { defaultFont } from "@/common/constant";

interface FontPickerSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  value?: IAppConfigKeyPathValue<T>;
}

function useFonts() {
  const [fonts, setFonts] = useState<FontData[] | null>(null);

  useEffect(() => {
    window
      .queryLocalFonts()
      .then((res) => {
        setFonts([defaultFont, ...res]);
      })
      .catch((e) => {
        console.log(e);
      });
  }, []);

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
        rendererAppConfig.setAppConfigPath(keyPath, {
          family: (val as FontData).family,
          fullName: (val as FontData).fullName,
          postscriptName: (val as FontData).postscriptName,
          style: (val as FontData).style,
        } as any);
      }}
    ></ListBoxSettingItem>
  );
}
