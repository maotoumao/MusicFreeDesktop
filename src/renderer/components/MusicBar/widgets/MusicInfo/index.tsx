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

export default function MusicInfo() {
  const musicItem = useCurrentMusic();

  return (
    <div className="music-info-container">
      {!musicItem ? null : (
        <>
          <img
            role="button"
            className="music-cover"
            crossOrigin="anonymous"
            src={musicItem.artwork}
            onError={setFallbackAlbum}
          ></img>

          <div
            className="open-detail"
            role="button"
            title="打开歌曲详情页"
            onClick={() => {
              Evt.emit("SHOW_MUSIC_DETAIL");
            }}
          >
            <SvgAsset iconName="chevron-double-up"></SvgAsset>
          </div>
          <div className="music-info">
            <div className="music-title">
              <span title={musicItem.title}>{musicItem.title}</span>
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
