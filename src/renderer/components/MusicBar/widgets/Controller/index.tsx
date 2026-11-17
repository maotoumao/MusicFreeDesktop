import SvgAsset from "@/renderer/components/SvgAsset";
import "./index.scss";
import trackPlayer from "@renderer/core/track-player";
import { useTranslation } from "react-i18next";
import { PlayerState } from "@/common/constant";
import { useCurrentMusic, usePlayerState } from "@renderer/core/track-player/hooks";
import { useLocateMusicInSheet } from "@renderer/core/music-locate/use-locate-music-in-sheet";

export default function Controller() {
    const playerState = usePlayerState();
    const currentMusic = useCurrentMusic();
    const locateMusicInSheet = useLocateMusicInSheet();

    const { t } = useTranslation();


    return (
        <div
            className="music-controller"
            title={t("music_bar.locate_music_in_sheet")}
            onClick={(e) => {
                // 只有点在空白处（三个按钮之外）才定位；
                // 点在按钮上时 target 是按钮自己，交给按钮处理
                if (e.target === e.currentTarget && currentMusic) {
                    locateMusicInSheet(currentMusic);
                }
            }}
        >
            <div className="skip controller-btn" title={t("music_bar.previous_music")} onClick={() => {
                trackPlayer.skipToPrev();

            }}>
                <SvgAsset iconName="skip-left"></SvgAsset>
            </div>
            <div
                className="play-or-pause controller-btn primary-btn"
                title={
                    playerState === PlayerState.Playing
                        ? t("music_bar.pause")
                        : t("music_bar.play")
                }
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
