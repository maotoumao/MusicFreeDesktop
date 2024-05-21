import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/shared/app-config/type";
import { Listbox } from "@headlessui/react";
import "./index.scss";
import defaultAppConfig from "@/shared/app-config/internal/default-app-config";
import Condition, { IfTruthy } from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import { isBasicType } from "@/common/normalize-util";
import useVirtualList from "@/renderer/hooks/useVirtualList";
import { rem } from "@/common/constant";
import { Fragment, useEffect, useRef } from "react";
import { setAppConfigPath } from "@/shared/app-config/renderer";
import SvgAsset from "@/renderer/components/SvgAsset";
import { Tooltip } from "react-tooltip";

interface ListBoxSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  options: Array<IAppConfigKeyPathValue<T>> | null;
  value?: IAppConfigKeyPathValue<T>;
  onChange?: (val: IAppConfigKeyPathValue<T>) => void;
  renderItem?: (item: IAppConfigKeyPathValue<T>) => string;
  width?: number | string;
  toolTip?: string;
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
    width,
    toolTip,
  } = props;

  return (
    <div className="setting-view--list-box-setting-item-container setting-row">
      <IfTruthy condition={toolTip}>
        <Tooltip id={`tt-${keyPath}`}></Tooltip>
      </IfTruthy>
      <Listbox
        value={value}
        onChange={
          onChange ??
          ((val) => {
            setAppConfigPath(keyPath, val);
          })
        }
      >
        <div className={"label-container"}>
          {label}
          <IfTruthy condition={toolTip}>
            <div
              className="question-mark-container"
              data-tooltip-id={`tt-${keyPath}`}
              data-tooltip-content={toolTip}
            >
              <SvgAsset iconName="question-mark-circle"></SvgAsset>
            </div>
          </IfTruthy>
        </div>
        <div className="options-container">
          <Listbox.Button
            as="div"
            className={"listbox-button"}
            style={{ width }}
          >
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
              width={width}
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
  width?: number | string;
}

function ListBoxOptions<T extends IAppConfigKeyPath>(
  props: IListBoxOptionsProps<T>
) {
  const { options, renderItem, width } = props;
  const containerRef = useRef<HTMLDivElement>();

  const virtualController = useVirtualList({
    data: options ?? [],
    estimizeItemHeight: 2.2 * rem,
    getScrollElement: () => containerRef.current,
    renderCount: 40,
    fallbackRenderCount: 20,
  });

  return (
    <div
      ref={containerRef}
      className={"listbox-options shadow backdrop-color"}
      style={{ width }}
    >
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
                width,
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
