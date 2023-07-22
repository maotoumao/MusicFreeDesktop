import { setUserPerference } from "@/renderer/utils/user-perference";
import Base from "../Base";
import "./index.scss";
import wcChannelImg from "@/assets/imgs/wechat_channel.jpg";
import { hideModal } from "../..";
import { ipcRendererSend } from "@/common/ipc-util/renderer";

interface IUpdateProps {
  currentVersion: string;
  update: ICommon.IUpdateInfo["update"];
}
export default function Update(props: IUpdateProps) {
  const { currentVersion, update = {} as ICommon.IUpdateInfo["update"] } =
    props;

  return (
    <Base withBlur defaultClose>
      <div className="modal--update-container shadow backdrop-color">
        <Base.Header>发现新版本</Base.Header>
        <div className="modal--body-container">
          <div className="version highlight">最新版本：{update.version}</div>
          <div className="version">当前版本：{currentVersion}</div>
          <div className="divider"></div>
          {update.changeLog.map((item, index) => (
            <p key={index}>{item}</p>
          ))}
        </div>
        <div className="divider"></div>
        <div className="footer-options">
          <div role="button" data-type="normalButton" onClick={() => {
            setUserPerference('skipVersion', update.version);
            hideModal();
          }}>
            跳过此版本
          </div>
          <div role="button" data-type="primaryButton" onClick={() => {
            ipcRendererSend('open-url', update.download[0]);
          }}>
            更新
          </div>
        </div>
      </div>
    </Base>
  );
}
