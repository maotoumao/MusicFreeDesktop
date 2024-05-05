import SvgAsset from "@/renderer/components/SvgAsset";
import Evt from "@/renderer/core/events";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import "./index.scss";
import {
  useCurrentMusic,
  useProgress,
} from "@/renderer/core/track-player/player";
import Tag from "@/renderer/components/Tag";
import { secondsToDuration } from "@/common/time-util";
import MusicFavorite from "@/renderer/components/MusicFavorite";
import { musicDetailShownStore } from "@/renderer/components/MusicDetail";
import albumImg from "@/assets/imgs/album-cover.jpg";
import { useTranslation } from "react-i18next";

export default function MusicInfo() {
  const musicItem = useCurrentMusic();
  const musicDetailShown = musicDetailShownStore.useValue();

  const {t} = useTranslation();

  function toggleMusicDetail() {
    if (musicDetailShown) {
      Evt.emit("HIDE_MUSIC_DETAIL");
    } else {
      Evt.emit("SHOW_MUSIC_DETAIL");
    }
  }

  return (
    <div className="music-info-container">
      {!musicItem ? null : (
        <>
          <img
            role="button"
            className="music-cover"
            crossOrigin="anonymous"
            src={musicItem.artwork ?? albumImg}
            onError={setFallbackAlbum}
          ></img>

          <div
            className="open-detail"
            role="button"
            title={musicDetailShown ? t("music_bar.close_music_detail_page") : t("music_bar.open_music_detail_page")}
            onClick={toggleMusicDetail}
          >
            <SvgAsset
              iconName={
                musicDetailShown ? "chevron-double-down" : "chevron-double-up"
              }
            ></SvgAsset>
          </div>
          <div className="music-info">
            <div className="music-title">
              <span role="button" onClick={toggleMusicDetail} title={musicItem.title}>{musicItem.title}</span>
              <Tag
                fill
                style={{
                  fontSize: "0.9rem",
                }}
              >
                {musicItem.platform}
              </Tag>
            </div>
            <div className="music-artist">
              <div className="artist">{musicItem.artist}</div>
              <Progress></Progress>
              <MusicFavorite musicItem={musicItem} size={18}></MusicFavorite>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Progress() {
  const { currentTime, duration } = useProgress();
  return (
    <div className="progress">
      {isFinite(duration)
        ? `${secondsToDuration(currentTime)}/${secondsToDuration(duration)}`
        : null}
    </div>
  );
}
