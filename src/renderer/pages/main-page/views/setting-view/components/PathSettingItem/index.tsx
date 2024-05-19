import {
  IAppConfigKeyPath,
  IAppConfigKeyPathValue,
} from "@/shared/app-config/type";
import "./index.scss";
import { ipcRendererInvoke, ipcRendererSend } from "@/shared/ipc/renderer";
import { toast } from "react-toastify";
import { setAppConfigPath } from "@/shared/app-config/renderer";
import { useTranslation } from "react-i18next";

interface PathSettingItemProps<T extends IAppConfigKeyPath> {
  keyPath: T;
  label?: string;
  value?: IAppConfigKeyPathValue<T>;
}

export default function PathSettingItem<T extends IAppConfigKeyPath>(
  props: PathSettingItemProps<T>
) {
  const { keyPath, label, value } = props;

  const { t } = useTranslation();

  return (
    <div className="setting-view--path-setting-item-container setting-row">
      <div className="label-container">{label}</div>
      <div className="options-container">
        <span className="path-container" title={value as string}>
          {value as string}
        </span>
        <div
          role="button"
          data-type="primaryButton"
          onClick={async () => {
            const result = await ipcRendererInvoke("show-open-dialog", {
              title: t("settings.choose_path"),
              defaultPath: value as string,
              properties: ["openDirectory"],
              buttonLabel: t("common.confirm"),
            });
            if (!result.canceled) {
              setAppConfigPath(keyPath, result.filePaths[0]! as any);
            }
          }}
        >
          {t("settings.change_path")}
        </div>
        <div
          role="button"
          data-type="normalButton"
          onClick={async () => {
            if (await window.fs.isFolder(value as string)) {
              ipcRendererSend("open-path", value as string);
            } else {
              toast.error(t("settings.folder_not_exist"));
            }
          }}
        >
          {t("settings.open_folder")}
        </div>
      </div>
      {/* </Listbox> */}
    </div>
  );
}
