import A from "@/renderer/components/A";
import "./index.scss";
import wxChannelImg from '@/assets/imgs/wechat_channel1.png'
import checkUpdate from "@/renderer/utils/check-update";
import { toast } from "react-toastify";

export default function About() {
  return (
    <div className="setting-view--about-container">
      <div className="setting-row about-version">
        当前版本：{window.globalData.appVersion}
        <A onClick={async () => {
          const needUpdate = await checkUpdate(true);
          if(!needUpdate) {
            toast.success('当前已是最新版本!')
          }
        }}>检查更新</A>
      </div>

      <div className="setting-row about-version">
        作者: <A href="https://github.com/maotoumao">@猫头猫</A> 
      </div>

      <div className="setting-row about-version">
        源代码：软件基于GPL3.0协议开源，
        <A href="https://github.com/maotoumao/MusicFreeDesktop">Github地址</A>
        <A href="https://gitee.com/maotoumao/MusicFreeDesktop">Gitee地址</A>
      </div>
      <div className="setting-row about-version">
        <A href="http://musicfree.upup.fun/">软件官网</A>
        <A href="https://github.com/maotoumao/MusicFree">移动版</A>
      </div>
      <img className="wx-channel" src={wxChannelImg}></img>
    </div>
  );
}
