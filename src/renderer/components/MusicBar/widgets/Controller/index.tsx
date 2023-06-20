import SvgAsset from "@/renderer/components/SvgAsset";
import "./index.scss";
import trackPlayer from "@/renderer/core/track-player";

export default function Controller() {
  return (
    <div className="music-controller">
      <div className="skip controller-btn" title="上一首" onClick={() => {}}>
        <SvgAsset iconName="skip-left"></SvgAsset>
      </div>
      <div
        className="play-or-pause controller-btn"
        onClick={() => {
        //   trackPlayer.pause();
        }}
      >
        <SvgAsset iconName="play"></SvgAsset>
      </div>
      <div
        className="skip controller-btn"
        title="下一首"
        onClick={() => {
          // getTopListDetail( {
          //   id: "eur_usa",
          //   title: "欧美榜",
          //   coverImg:
          //     "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095229556_327x327_1383.png",
          // } as any);
        }}
      >
        <SvgAsset iconName="skip-right"></SvgAsset>
      </div>
    </div>
  );
}
