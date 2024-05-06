import defaultAppConfig from "@/common/app-config/default-app-config";
import { setAppConfigPath } from "@/common/app-config/renderer";
import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/common/app-config/type";
import SvgAsset from "@/renderer/components/SvgAsset";
import classNames from "@/renderer/utils/classnames";

interface ICheckBoxSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  checked?: IAppConfigKeyPathValue<T>;
  onCheckChanged?: (checked: boolean) => void;
}

export default function CheckBoxSettingItem<T extends IAppConfigKeyPath>(
  props: ICheckBoxSettingItemProps<T>
) {
  const {
    keyPath,
    label,
    checked = defaultAppConfig[keyPath],
    onCheckChanged,
  } = props;

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
          if (onCheckChanged) {
            onCheckChanged(!checked);
          } else {
            setAppConfigPath(keyPath, !checked as any);
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
