import "./index.scss";
import SvgAsset from "../SvgAsset";

const musicItem = {
  id: "1001",
  platform: "猫头猫",
  artist: "猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫",
  title: "今天猫头猫没有写代码啊啊啊啊啊啊啊啊啊",
  album: "小猫咪",
  artwork:
    "https://i0.hdslb.com/bfs/archive/3e6673d190c2e243e1faaeae2c845049d119309a.jpg",
  url: "xxx",
  duration: 1200,
};

export default function MusicBar() {
  return (
    <div className="music-bar-container">
      <div className="music-info-container">
        <img
          role="button"
          className="music-cover"
          crossOrigin="anonymous"
          src={musicItem.artwork}
        ></img>
        <div className="open-detail" title="打开歌曲详情页">
          <SvgAsset iconName="chevron-double-up"></SvgAsset>
        </div>
        <div className="music-info">
          <div className="music-title">{musicItem.title}</div>
          <div className="music-artist">
            <div>{musicItem.artist}</div>
            <SvgAsset iconName="heart-outline"></SvgAsset>
          </div>
        </div>
      </div>

      <div className="music-controller">
        <div className="skip controller-btn" title="上一首">
          <SvgAsset iconName="skip-left"></SvgAsset>
        </div>
        <div className="play-or-pause controller-btn">
          <SvgAsset iconName="play"></SvgAsset>
        </div>
        <div className="skip controller-btn" title="下一首">
          <SvgAsset iconName="skip-right"></SvgAsset>
        </div>
      </div>
      <div className="music-slidebar">
        <span>00:26</span>
        <input type="range" className="slidebar"></input>
        <span>03:51</span>
      </div>
      <div className="music-extra">
        <div className="extra-btn">
          <SvgAsset iconName="lyric"></SvgAsset>
        </div>
        <div className="extra-btn">
          <SvgAsset iconName="repeat-song-1"></SvgAsset>
        </div>
        <div className="extra-btn">
          <SvgAsset iconName="playlist"></SvgAsset>
        </div>
        {/* <div className="extra-btn">
          <RepeatSongSvg></RepeatSongSvg>
        </div>
        <div className="extra-btn">
          <ShuffleSvg></ShuffleSvg>
        </div> */}
      </div>
    </div>
  );
}
