import SvgAsset from "@/renderer/components/SvgAsset";
import "./index.scss";
import trackPlayer from "@/renderer/core/track-player.new";
import { useTranslation } from "react-i18next";
import { PlayerState } from "@/common/constant";
import {usePlayerState} from "@renderer/core/track-player.new/hooks";

export default function Controller() {
  const playerState = usePlayerState();

  const {t} = useTranslation();


  return (
    <div className="music-controller">
      <div className="skip controller-btn" title={t("music_bar.previous_music")} onClick={() => {
          trackPlayer.skipToPrev();

      }}>
        <SvgAsset iconName="skip-left"></SvgAsset>
      </div>
      <div
        className="play-or-pause controller-btn primary-btn"
        onClick={() => {
          if(playerState === PlayerState.Playing) {
            trackPlayer.pause();
          } else {
            trackPlayer.resume();
          }
        }}
      >
        <SvgAsset
          iconName={
            playerState !== PlayerState.Playing ? "play" : "pause"
          }
        ></SvgAsset>
      </div>
      <div
        className="skip controller-btn"
        title={t("music_bar.next_music")}
        onClick={() => {

          trackPlayer.skipToNext();
        }}
      >
        <SvgAsset iconName="skip-right"></SvgAsset>
      </div>
    </div>
  );
}
