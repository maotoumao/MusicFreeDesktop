import Evt from "@renderer/core/events";
import "./index.scss";
import { memo, useState } from "react";
import trackPlayer from "@/renderer/core/track-player";
import Condition from "@/renderer/components/Condition";
import Empty from "@/renderer/components/Empty";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import MusicFavorite from "@/renderer/components/MusicFavorite";
import Tag from "@/renderer/components/Tag";
import SvgAsset from "@/renderer/components/SvgAsset";

const baseId = "music-bar--play-list";

export default function PlayList() {
  const [show, setShow] = useState(false);
  const musicQueue = trackPlayer.useMusicQueue();
  const currentMusic = trackPlayer.useCurrentMusic();

  Evt.use("SWITCH_PLAY_LIST", (payload) => {
    if (!payload) {
      setShow((_) => !_);
    } else {
      setShow((_) => payload.show);
    }
  });

  return show ? (
    <div
      id={baseId}
      className="music-bar--play-list-container"
      onClick={(e) => {
        console.log(e);
        if ((e.target as HTMLElement)?.id === baseId) {
          setShow(false);
        }
      }}
    >
      <div className="content-container animate__animated animate__slideInRight">
        <div className="header">
          <div className="title">播放列表({musicQueue.length}首)</div>
          <div
            role="button"
            onClick={() => {
              trackPlayer.clearQueue();
            }}
          >
            清空
          </div>
        </div>
        <div className="divider"></div>
        <div className="music-list-container">
          <Condition
            condition={musicQueue.length !== 0}
            falsy={<Empty></Empty>}
          >
            {musicQueue.map((item) => (
              <PlayListMusicItem
                key={getMediaPrimaryKey(item)}
                isPlaying={isSameMedia(currentMusic, item)}
                musicItem={item}
              ></PlayListMusicItem>
            ))}
          </Condition>
        </div>
      </div>
    </div>
  ) : null;
}

interface IPlayListMusicItemProps {
  isPlaying: boolean;
  musicItem: IMusic.IMusicItem;
}
function _PlayListMusicItem(props: IPlayListMusicItemProps) {
  const { isPlaying, musicItem } = props;

  return (
    <div
      className="play-list--music-item-container"
      style={{
        color: `var(--${isPlaying ? "primaryColor" : "textColor"})`,
      }}
    >
      <MusicFavorite musicItem={musicItem} size={16}></MusicFavorite>
      <div className="playlist--title">{musicItem.title}</div>
      <div className="playlist--artist">{musicItem.artist ?? "-"}</div>
      <div className="playlist--platform">
        <Tag>{musicItem.platform}</Tag>
      </div>
      <div
        className="playlist--remove"
        role="button"
        onClick={() => {
          trackPlayer.removeFromQueue(musicItem);
        }}
      >
        <SvgAsset iconName="x-mark" size={16}></SvgAsset>
      </div>
    </div>
  );
}

const PlayListMusicItem = memo(
  _PlayListMusicItem,
  (prev, curr) =>
    prev.isPlaying === curr.isPlaying && prev.musicItem === curr.musicItem
);
