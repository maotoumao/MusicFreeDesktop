import SvgAsset from "@/renderer/components/SvgAsset";
import "./index.scss";
import trackPlayer from "@/renderer/core/track-player";

export default function Controller() {
  const playerState = trackPlayer.usePlayerState();
  return (
    <div className="music-controller">
      <div className="skip controller-btn" title="上一首" onClick={() => {
          trackPlayer.skipToPrev();

      }}>
        <SvgAsset iconName="skip-left"></SvgAsset>
      </div>
      <div
        className="play-or-pause controller-btn primary-btn"
        onClick={() => {
          if(playerState === trackPlayer.PlayerState.Playing) {
            trackPlayer.pause();
          } else {
            trackPlayer.resumePlay();
          }
        }}
      >
        <SvgAsset
          iconName={
            playerState !== trackPlayer.PlayerState.Playing ? "play" : "pause"
          }
        ></SvgAsset>
      </div>
      <div
        className="skip controller-btn"
        title="下一首"
        onClick={() => {
      
          trackPlayer.skipToNext();
        }}
      >
        <SvgAsset iconName="skip-right"></SvgAsset>
      </div>
    </div>
  );
}
