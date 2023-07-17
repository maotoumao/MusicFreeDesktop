import rendererAppConfig from "@/common/app-config/renderer";
import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/common/app-config/type";
import { Listbox } from "@headlessui/react";
import "./index.scss";
import defaultAppConfig from "@/common/app-config/default-app-config";

interface ListBoxSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  options: Array<{
    /** 存储的value */
    value: IAppConfigKeyPathValue<T>;
    /** 展示的值 */
    title?: string;
  }>;
  value?: IAppConfigKeyPathValue<T>;
}

export default function ListBoxSettingItem<T extends IAppConfigKeyPath>(
  props: ListBoxSettingItemProps<T>
) {
  const { keyPath, label, options, value = defaultAppConfig[keyPath] } = props;
  return (
    <div className="setting-view--list-box-setting-item-container setting-row">
      <Listbox
        value={value}
        onChange={(val) => {
          rendererAppConfig.setAppConfigPath(keyPath, val);
        }}
      >
        <div className={"label-container"}>
          {label}
        </div>
        <div className="options-container">
          <Listbox.Button as="div" className={'listbox-button'}>{value as string}
          </Listbox.Button>
          <Listbox.Options className={'listbox-options'}>
            {options.map((option, index) => (
              <Listbox.Option className={'listbox-option'} key={index} value={option.value}>
                {option.title ?? (option.value as string)}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>
    </div>
  );
}
