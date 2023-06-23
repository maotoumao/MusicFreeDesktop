import Evt from "@renderer/core/events";
import "./index.scss";
import { CSSProperties, memo, useEffect, useRef, useState } from "react";
import trackPlayer from "@/renderer/core/track-player";
import Condition from "@/renderer/components/Condition";
import Empty from "@/renderer/components/Empty";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import MusicFavorite from "@/renderer/components/MusicFavorite";
import Tag from "@/renderer/components/Tag";
import SvgAsset from "@/renderer/components/SvgAsset";
import useVirtualList from "@/renderer/hooks/useVirtualList";
import { rem } from "@/common/constant";

const baseId = "music-bar--play-list";
const estimizeItemHeight = 2.6 * rem;

export default function PlayList() {
  const [show, setShow] = useState(false);
  const musicQueue = trackPlayer.useMusicQueue();
  const currentMusic = trackPlayer.useCurrentMusic();
  const scrollElementRef = useRef<HTMLDivElement>();

  Evt.use("SWITCH_PLAY_LIST", (payload) => {
    if (!payload) {
      setShow((_) => !_);
    } else {
      setShow((_) => payload.show);
    }
  });

  const virtualController = useVirtualList({
    estimizeItemHeight,
    data: musicQueue,
    getScrollElement() {
      return scrollElementRef.current;
    },
    fallbackRenderCount: 0,
  });

  useEffect(() => {
    if (show) {
      virtualController.setScrollElement(scrollElementRef.current);
    }
  }, [show]);

  return show ? (
    <div
      id={baseId}
      className="music-bar--play-list-container"
      onClick={(e) => {
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
        <div className="playlist--music-list-container" ref={scrollElementRef}>
          <Condition
            condition={musicQueue.length !== 0}
            falsy={<Empty></Empty>}
          >
            <div
              className="playlist--music-list-scroll"
              style={{
                height: virtualController.totalHeight,
              }}
            >
              {virtualController.virtualItems.map((virtualItem) => {
                const item = virtualItem.dataItem;
                return (
                  <div
                    key={virtualItem.rowIndex}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: virtualItem.top,
                    }}
                  >
                    <PlayListMusicItem
                      key={getMediaPrimaryKey(item)}
                      isPlaying={isSameMedia(currentMusic, item)}
                      musicItem={item}
                    ></PlayListMusicItem>
                  </div>
                );
              })}
            </div>
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
  console.log("RERENDER", musicItem);

  return (
    <div
      className="play-list--music-item-container"
      style={{
        color: `var(--${isPlaying ? "primaryColor" : "textColor"})`,
      }}
      onDoubleClick={() => {
        trackPlayer.playMusic(musicItem);
      }}
    >
      <MusicFavorite musicItem={musicItem} size={16}></MusicFavorite>
      <div className="playlist--title" title={musicItem.title}>
        {musicItem.title}
      </div>
      <div className="playlist--artist" title={musicItem.artist}>
        {musicItem.artist ?? "-"}
      </div>
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
