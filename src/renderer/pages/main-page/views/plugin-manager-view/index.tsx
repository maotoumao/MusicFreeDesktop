import { showModal } from "@/renderer/components/Modal";
import PluginTable from "./components/plugin-table";
import "./index.scss";
import { getUserPerference } from "@/renderer/utils/user-perference";

export default function PluginManagerView() {

  const subscription = getUserPerference('subscription');

  return (
    <div className="plugin-manager-view-container">
      <div className="header">插件管理</div>
      <div className="operation-area">
        <div className="left-part">
          <div role="button" data-type="normalButton" onClick={() => {
            
          }}>
            从本地安装
          </div>
          <div
            role="button"
            data-type="normalButton"
            onClick={() => {
              showModal("SimpleInputWithState", {
                title: "从网络安装插件",
                placeholder: "请输入插件源地址(链接以json或js结尾)",
                okText: "安装",
                withLoading: true,

                hints: [
                  "插件需要满足 MusicFree 特定的插件协议，具体可在官方网站中查看",
                ],
              });
            }}
          >
            从网络安装
          </div>
        </div>
        <div className="right-part">
          <div role="button" data-type="normalButton">
            订阅设置
          </div>
          <div role="button" data-type="normalButton" data-disabled={true}>
            更新订阅
          </div>
        </div>
      </div>
      <PluginTable></PluginTable>
    </div>
  );
}
