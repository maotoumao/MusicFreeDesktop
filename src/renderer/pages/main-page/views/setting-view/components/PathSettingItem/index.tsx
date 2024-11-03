import AppConfig from "@shared/app-config/renderer";
import "./index.scss";
import {ipcRendererInvoke, ipcRendererSend} from "@/shared/ipc/renderer";
import {toast} from "react-toastify";
import {useTranslation} from "react-i18next";
import {IAppConfig} from "@/types/app-config";
import useAppConfig from "@/hooks/useAppConfig";

interface PathSettingItemProps<T extends keyof IAppConfig> {
    keyPath: T;
    label?: string;
}

export default function PathSettingItem<T extends keyof IAppConfig>(
    props: PathSettingItemProps<T>
) {
    const {keyPath, label} = props;
    const value = useAppConfig(keyPath);
    const {t} = useTranslation();

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
                            AppConfig.setConfig({
                                [keyPath]: result.filePaths[0]! as any,
                            });
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
