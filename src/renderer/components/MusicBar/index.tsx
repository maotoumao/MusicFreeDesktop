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
import Controller from "./widgets/Controller";
import Extra from "./widgets/Extra";


export default function MusicBar() {
  return (
    <div className="music-bar-container">
      <Slider></Slider>
      <MusicInfo></MusicInfo>
      <Controller></Controller>
      <Extra></Extra>
      <PlayList></PlayList>
    </div>
  );
}
