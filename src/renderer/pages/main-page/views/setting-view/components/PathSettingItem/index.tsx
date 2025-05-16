import AppConfig from "@shared/app-config/renderer";
import "./index.scss";
import {toast} from "react-toastify";
import {useTranslation} from "react-i18next";
import {IAppConfig} from "@/types/app-config";
import useAppConfig from "@/hooks/useAppConfig";
import {dialogUtil, fsUtil, shellUtil, appUtil} from "@shared/utils/renderer";

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
                        const currentPath = value as string;
                        // 如果当前路径为空，则使用用户主目录作为默认路径
                        const defaultPathToShow = currentPath || (await appUtil.getPath("home"));
                        const result = await dialogUtil.showOpenDialog({
                            title: t("settings.choose_path"),
                            defaultPath: defaultPathToShow, // 修改点
                            properties: ["openFile"], // 修改点：选择文件而非目录
                            buttonLabel: t("common.confirm"),
                        });
                        if (!result.canceled && result.filePaths.length > 0) {
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
                        // 注意：这里判断的是文件是否存在，因为MPV路径是文件
                        if (await fsUtil.isFile(value as string)) {
                            // 打开文件所在的文件夹，并选中该文件
                            shellUtil.showItemInFolder(value as string);
                        } else {
                            toast.error(t("settings.folder_not_exist")); // 提示语可能需要调整为“文件不存在或路径无效”
                        }
                    }}
                >
                    {t("settings.open_folder")} 
                </div>
            </div>
        </div>
    );
}
