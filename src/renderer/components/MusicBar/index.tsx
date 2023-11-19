import Slider from "./widgets/Slider";
import MusicInfo from "./widgets/MusicInfo";
import Controller from "./widgets/Controller";
import Extra from "./widgets/Extra";

import "./index.scss";

export default function MusicBar() {
  return (
    <div className="music-bar-container background-color">
      <Slider></Slider>
      <MusicInfo></MusicInfo>
      <Controller></Controller>
      <Extra></Extra>
    </div>
  );
}
