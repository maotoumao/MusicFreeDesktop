import { hideModal, showModal } from "@/renderer/components/Modal";
import PluginTable from "./components/plugin-table";
import "./index.scss";
import { getUserPreference } from "@/renderer/utils/user-perference";
import { ipcRendererInvoke } from "@/shared/ipc/renderer";
import { toast } from "react-toastify";
import A from "@/renderer/components/A";
import { Trans, useTranslation } from "react-i18next";

export default function PluginManagerView() {
  const { t } = useTranslation();

  return (
    <div
      id="page-container"
      className="page-container plugin-manager-view-container"
    >
      <div className="header">
        {t("plugin_management_page.plugin_management")}
      </div>
      <div className="operation-area">
        <div className="left-part">
          <div
            role="button"
            data-type="normalButton"
            onClick={async () => {
              try {
                const result = await ipcRendererInvoke("show-open-dialog", {
                  title: t("plugin_management_page.choose_plugin"),
                  buttonLabel: t("plugin_management_page.install"),
                  filters: [
                    {
                      extensions: ["js", "json"],
                      name: t("plugin_management_page.musicfree_plugin"),
                    },
                  ],
                });
                if (result.canceled) {
                  return;
                }
                await ipcRendererInvoke(
                  "install-plugin-local",
                  result.filePaths[0]
                );
                toast.success(t("plugin_management_page.install_successfully"));
              } catch (e) {
                toast.warn(
                  `${t("plugin_management_page.install_failed")}: ${
                    e.message ?? t("plugin_management_page.invalid_plugin")
                  }`
                );
              }
            }}
          >
            {t("plugin_management_page.install_from_local_file")}
          </div>
          <div
            role="button"
            data-type="normalButton"
            onClick={() => {
              showModal("SimpleInputWithState", {
                title: t("plugin_management_page.install_plugin_from_network"),
                placeholder: t(
                  "plugin_management_page.error_hint_plugin_should_end_with_js_or_json"
                ),
                okText: t("plugin_management_page.install"),
                loadingText: t("plugin_management_page.installing"),
                withLoading: true,
                async onOk(text) {
                  if (
                    text.trim().endsWith(".json") ||
                    text.trim().endsWith(".js")
                  ) {
                    return ipcRendererInvoke("install-plugin-remote", text);
                  } else {
                    throw new Error(
                      t(
                        "plugin_management_page.error_hint_plugin_should_end_with_js_or_json"
                      )
                    );
                  }
                },
                onPromiseResolved() {
                  toast.success(
                    t("plugin_management_page.install_successfully")
                  );
                  hideModal();
                },
                onPromiseRejected(e) {
                  toast.warn(
                    `${t("plugin_management_page.install_failed")}: ${
                      e.message ?? t("plugin_management_page.invalid_plugin")
                    }`
                  );
                },
                hints: [
                  <Trans
                    i18nKey={"plugin_management_page.info_hint_install_plugin"}
                    components={{
                      a: <A href="https://musicfree.upup.fun"></A>,
                    }}
                  ></Trans>,
                ],
              });
            }}
          >
            {t("plugin_management_page.install_plugin_from_network")}
          </div>
          {/* <div
            role="button"
            data-type="normalButton"
            onClick={() => {
              showModal("SimpleInputWithState", {
                title: "从网络安装插件",
                placeholder: "请输入插件源地址(链接以json或js结尾)",
                okText: "安装",
                loadingText: "安装中",
                withLoading: true,
                async onOk(text) {
                  if (
                    text.trim().endsWith(".json") ||
                    text.trim().endsWith(".js")
                  ) {
                    return ipcRendererInvoke("install-plugin-remote", text);
                  } else {
                    throw new Error("插件链接需要以json或者js结尾");
                  }
                },
                onPromiseResolved() {
                  toast.success("安装成功~");
                  hideModal();
                },
                onPromiseRejected(e) {
                  toast.warn(`安装失败: ${e.message ?? "无效插件"}`);
                },
                hints: [
                  "插件需要满足 MusicFree 特定的插件协议，具体可在官方网站中查看",
                ],
              });
            }}
          >
            一键更新
          </div> */}
        </div>
        <div className="right-part">
          <div
            role="button"
            data-type="normalButton"
            onClick={() => {
              showModal("PluginSubscription");
            }}
          >
            {t("plugin_management_page.subscription_setting")}
          </div>
          <div
            role="button"
            data-type="normalButton"
            onClick={async () => {
              const subscription = getUserPreference("subscription");

              if (subscription?.length) {
                for (let i = 0; i < subscription.length; ++i) {
                  await ipcRendererInvoke(
                    "install-plugin-remote",
                    subscription[i].srcUrl
                  );
                }
                toast.success(t("plugin_management_page.update_successfully"));
              } else {
                toast.warn(t("plugin_management_page.no_subscription"));
              }
            }}
          >
            {t("plugin_management_page.update_subscription")}
          </div>
        </div>
      </div>
      <PluginTable></PluginTable>
    </div>
  );
}
