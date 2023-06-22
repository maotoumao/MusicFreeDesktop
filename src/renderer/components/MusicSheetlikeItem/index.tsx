import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import "./index.scss";
import albumImg from "@/assets/imgs/album-cover.jpg";
import Tag from "../Tag";
import Condition from "../Condition";
import dayjs from "dayjs";
import SvgAsset from "../SvgAsset";
import { normalizeNumber } from "@/common/normalize-util";

interface IMusicSheetlikeItemProps {
  mediaItem: IMusic.IMusicSheetItem;
  onClick?: (mediaItem: IMusic.IMusicSheetItem) => void;
}

export default function MusicSheetlikeItem(props: IMusicSheetlikeItemProps) {
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
          src={mediaItem?.artwork || albumImg}
          onError={setFallbackAlbum}
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
                {normalizeNumber(mediaItem?.playCount)}
              </Condition>
            </div>
          </div>
        </Condition>
      </div>
      <div className="media-info">
        <div className="title">{mediaItem?.title}</div>
        <div className="author">
          <span>{mediaItem?.artist ?? ""}</span>
        </div>
      </div>
    </div>
  );
}
