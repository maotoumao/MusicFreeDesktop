import SvgAsset from "@/renderer/components/SvgAsset";
import Evt from "@/renderer/core/events";
import "./index.scss";
import SwitchCase from "@/renderer/components/SwitchCase";
import trackPlayer from "@/renderer/core/track-player";
import { RepeatMode } from "@/renderer/core/track-player/enum";

export default function Extra() {
  const repeatMode = trackPlayer.useRepeatMode();
  return (
    <div className="music-extra">
      <div className="extra-btn">
        <SvgAsset iconName="lyric"></SvgAsset>
      </div>
      <div
        className="extra-btn"
        onClick={() => {
          trackPlayer.toggleRepeatMode();
        }}
        title={
          repeatMode === RepeatMode.Loop
            ? "单曲循环"
            : repeatMode === RepeatMode.Queue
            ? "列表循环"
            : "随机播放"
        }
      >
        <SwitchCase.Switch switch={repeatMode}>
          <SwitchCase.Case case={RepeatMode.Loop}>
            <SvgAsset iconName="repeat-song"></SvgAsset>
          </SwitchCase.Case>
          <SwitchCase.Case case={RepeatMode.Queue}>
            <SvgAsset iconName="repeat-song-1"></SvgAsset>
          </SwitchCase.Case>
          <SwitchCase.Case case={RepeatMode.Shuffle}>
            <SvgAsset iconName="shuffle"></SvgAsset>
          </SwitchCase.Case>
        </SwitchCase.Switch>
      </div>
      <div
        className="extra-btn"
        title="播放列表"
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
  );
}
