import rendererAppConfig from "@/common/app-config/renderer";
import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/common/app-config/type";
import { Listbox } from "@headlessui/react";
import "./index.scss";
import defaultAppConfig from "@/common/app-config/default-app-config";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import { isBasicType } from "@/common/normalize-util";
import useVirtualList from "@/renderer/hooks/useVirtualList";
import { rem } from "@/common/constant";
import { Fragment, useEffect, useRef } from "react";

interface ListBoxSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  options: Array<IAppConfigKeyPathValue<T>> | null;
  value?: IAppConfigKeyPathValue<T>;
  onChange?: (val: IAppConfigKeyPathValue<T>) => void;
  renderItem?: (item: IAppConfigKeyPathValue<T>) => string;
}

export default function ListBoxSettingItem<T extends IAppConfigKeyPath>(
  props: ListBoxSettingItemProps<T>
) {
  const {
    keyPath,
    label,
    options,
    value = defaultAppConfig[keyPath],
    onChange,
    renderItem,
  } = props;

  return (
    <div className="setting-view--list-box-setting-item-container setting-row">
      <Listbox
        value={value}
        onChange={
          onChange ??
          ((val) => {
            rendererAppConfig.setAppConfigPath(keyPath, val);
          })
        }
      >
        <div className={"label-container"}>{label}</div>
        <div className="options-container">
          <Listbox.Button as="div" className={"listbox-button"}>
            <span>
              {renderItem
                ? renderItem(value)
                : isBasicType(value)
                ? (value as string)
                : ""}
            </span>
          </Listbox.Button>
          <Listbox.Options as={"div"}>
            <ListBoxOptions
              options={options}
              renderItem={renderItem}
            ></ListBoxOptions>
          </Listbox.Options>
        </div>
      </Listbox>
    </div>
  );
}

interface IListBoxOptionsProps<T extends IAppConfigKeyPath> {
  options: Array<IAppConfigKeyPathValue<T>> | null;
  renderItem?: (item: IAppConfigKeyPathValue<T>) => string;
}

function ListBoxOptions<T extends IAppConfigKeyPath>(
  props: IListBoxOptionsProps<T>
) {
  const { options, renderItem } = props;
  const containerRef = useRef<HTMLDivElement>();

  const virtualController = useVirtualList({
    data: options ?? [],
    estimizeItemHeight: 2.2 * rem,
    getScrollElement: () => containerRef.current,
    renderCount: 40,
    fallbackRenderCount: 20,
  });

  return (
    <div ref={containerRef} className={"listbox-options shadow backdrop-color"}>
      <Condition condition={options !== null} falsy={<Loading></Loading>}>
        <div
          style={{
            position: "relative",
            height: virtualController.totalHeight,
          }}
        >
          {virtualController.virtualItems?.map?.((virtualItem) => (
            <Listbox.Option
              className={"listbox-option"}
              key={virtualItem.rowIndex}
              value={virtualItem.dataItem}
              style={{
                position: "absolute",
                top: virtualItem.top,
              }}
              as="div"
            >
              <div>
                {renderItem
                  ? renderItem(virtualItem.dataItem)
                  : isBasicType(virtualItem.dataItem)
                  ? (virtualItem.dataItem as string)
                  : ""}
              </div>
            </Listbox.Option>
          ))}
        </div>
      </Condition>
    </div>
  );
}
