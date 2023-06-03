import "./index.scss";
import SvgAsset from "../SvgAsset";
import PlayList from "./widgets/PlayList";
import { useState } from "react";
import Evt from "@renderer/core/events";
import trackPlayer from "@/renderer/core/track-player/internal";
import { ipcRendererInvoke } from "@/common/ipc-util/renderer";

const musicItem = {
  id: "1001",
  platform: "猫头猫",
  artist: "猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫",
  title: "今天猫头猫没有写代码啊啊啊啊啊啊啊啊啊",
  album: "小猫咪",
  artwork:
    "http://i.giphy.com/l46Cs36c9HrHMExoc.gif",
  url: "xxx",
  duration: 1200,
};

export default function MusicBar() {

  return (
    <div className="music-bar-container">
      <div className="music-info-container" onClick={() => {
        Evt.emit('SHOW_MUSIC_DETAIL');
      }}>
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
        <div className="play-or-pause controller-btn" onClick={() => {
          trackPlayer.pause();
        }}>
          <SvgAsset iconName="play"></SvgAsset>
        </div>
        <div className="skip controller-btn" title="下一首" onClick={() => {
          // getTopListDetail( {
          //   id: "eur_usa",
          //   title: "欧美榜",
          //   coverImg:
          //     "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095229556_327x327_1383.png",
          // } as any);
        }}>
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
        <div className="extra-btn" role="button" onClick={() => {
          Evt.emit('SWITCH_PLAY_LIST');
        }}>
          <SvgAsset iconName="playlist"></SvgAsset>
        </div>
        {/* <div className="extra-btn">
          <RepeatSongSvg></RepeatSongSvg>
        </div>
        <div className="extra-btn">
          <ShuffleSvg></ShuffleSvg>
        </div> */}
      </div>
      <PlayList></PlayList>
    </div>
  );
}
