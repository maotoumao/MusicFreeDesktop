import Base from "../Base";
import "./index.scss";
import wcChannelImg from "@/assets/imgs/wechat_channel.jpg";

export default function Sparkles() {
  // TODO a标签不对
  return (
    <Base withBlur defaultClose>
      <div className="modal--sparkles-container">
        <Base.Header>✨✨✨</Base.Header>
        <div className="body-container">
          <h3>开发者的话：</h3>
          <p>
            首先感谢你使用这款软件。开发这款软件的初衷首先是满足自己日常的需求，顺便分享出来，如果能对更多人有帮助那再好不过。简单的介绍视频可以戳
            <a
              href="https://mp.weixin.qq.com/s/sH_2vRm7EyBGgWggkJmsdg"
              target="_blank"
            >
              这里
            </a>
            ，是公众号链接，如果要了解后续更新的话，点个关注也行。
          </p>
          <div className="img-container">
            <img src={wcChannelImg} className="wechat-channel"></img>
          </div>
          <p>
            本软件完全免费，并基于GPL协议开源，仅供学习参考使用，不可用于商业目的。代码地址如下，如果打不开试试把github换成gitee:
            <a>https://github.com/maotoumao/MusicFree</a>
          </p>
          <p>
            本软件仅仅是一个本地播放器，也可以通过插件扩展第三方源，插件可以完成包括播放、搜索在内的大部分功能；如果你是从第三方下载的插件，请一定谨慎识别这些插件的安全性，保护好自己。（注意：插件以及插件可能产生的数据与本软件无关，请使用者合理合法使用。）
          </p>
          <p>
            还请注意本软件只是个人的业余项目，距离正式版也有很长一段距离。如果你在找成熟稳定的音乐软件，可以考虑其他优秀的软件。当然我会一直维护，让它变得尽可能的完善一些。业余时间用爱发电，进度慢还请见谅。
          </p>
          <p>
            最后，如果真的有人看到这里，希望这款软件可以帮到你，这也是这款软件存在的意义。
          </p>
          <p className="footer">by: 猫头猫</p>
        </div>
      </div>
    </Base>
  );
}
