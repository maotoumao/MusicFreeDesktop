import "./index.scss";
import SvgAsset from "../SvgAsset";
import PlayList from "./widgets/PlayList";
import { useState } from "react";
import Evt from "@renderer/core/events";
import trackPlayer from "@/renderer/core/track-player/internal";
import { ipcRendererInvoke } from "@/common/ipc-util/renderer";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import Slider from "./widgets/Slider";
import MusicInfo from "./widgets/MusicInfo";


export default function MusicBar() {
  return (
    <div className="music-bar-container">
      <Slider></Slider>
      <MusicInfo></MusicInfo>
      <div className="music-controller">
        <div className="skip controller-btn" title="上一首" onClick={() => {}}>
          <SvgAsset iconName="skip-left"></SvgAsset>
        </div>
        <div
          className="play-or-pause controller-btn"
          onClick={() => {
            trackPlayer.pause();
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
      {/* <div className="music-slidebar">
        <span>00:26</span>
        <input type="range" className="slidebar"></input>
        <span>03:51</span>
      </div> */}
      <div className="music-extra">
        <div className="extra-btn">
          <SvgAsset iconName="lyric"></SvgAsset>
        </div>
        <div className="extra-btn">
          <SvgAsset iconName="repeat-song-1"></SvgAsset>
        </div>
        <div
          className="extra-btn"
          role="button"
          onClick={() => {
            Evt.emit("SWITCH_PLAY_LIST");
          }}
        >
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
