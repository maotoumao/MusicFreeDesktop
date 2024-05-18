import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import "./index.scss";
import albumImg from "@/assets/imgs/album-cover.jpg";
import Condition from "../Condition";
import dayjs from "dayjs";
import SvgAsset from "../SvgAsset";
import { normalizeNumber } from "@/common/normalize-util";
import { memo } from "react";
import { isCN } from "@/shared/i18n/renderer";

interface IMusicSheetlikeItemProps {
  mediaItem: IMusic.IMusicSheetItem;
  onClick?: (mediaItem: IMusic.IMusicSheetItem) => void;
}

function MusicSheetlikeItem(props: IMusicSheetlikeItemProps) {
  const { mediaItem, onClick } = props;

  return (
    <div
      className="components--albumlike-item-container"
      role="button"
      onClick={() => {
        onClick?.(mediaItem);
      }}
    >
      <div className="album-img-wrapper">
        <img
          src={mediaItem?.artwork || mediaItem?.coverImg || albumImg}
          onError={setFallbackAlbum}
          loading='lazy'
        ></img>
        <Condition
          condition={
            mediaItem?.playCount || mediaItem?.worksNum || mediaItem?.createAt
          }
        >
          <div className="album-play-info">
            {mediaItem?.createAt ? (
              dayjs(mediaItem.createAt).format("YYYY-MM-DD")
            ) : (
              <div></div>
            )}
            <div className="play-count">
              <Condition condition={mediaItem?.playCount}>
                <SvgAsset iconName={"headphone"} size={14}></SvgAsset>
                {normalizeNumber(mediaItem?.playCount, !isCN())}
              </Condition>
            </div>
          </div>
        </Condition>
      </div>
      <div className="media-info">
        <div className="title" title={mediaItem?.title}>
          {mediaItem?.title}
        </div>
        <div className="author" title={mediaItem?.artist ?? mediaItem?.description}>
          <span>{mediaItem?.artist ?? mediaItem?.description ?? ""}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(
  MusicSheetlikeItem,
  (prev, curr) =>
    prev.mediaItem === curr.mediaItem && prev.onClick === curr.onClick
);
