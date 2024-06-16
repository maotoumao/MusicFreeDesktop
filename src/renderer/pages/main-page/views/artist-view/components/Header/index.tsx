import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";
import Tag from "@/renderer/components/Tag";
import Condition from "@/renderer/components/Condition";
import "./index.scss";
import { useTranslation } from "react-i18next";

interface IProps {
  artistItem: IArtist.IArtistItem;
}

export default function Header(props: IProps) {
  const { artistItem } = props;
  const { t } = useTranslation();

  return (
    <div className="artist-view--header-container">
      <img
        draggable={false}
        src={artistItem?.avatar ?? albumImg}
        onError={setFallbackAlbum}
      ></img>
      <div className="artist-info">
        <div className="title-container">
          <Tag>{artistItem?.platform}</Tag>
          <div className="title">
            {artistItem?.name ?? t("media.unknown_artist")}
          </div>
        </div>

        <Condition condition={artistItem?.description}>
          <div
            className="info-container description-container"
            data-fold="true"
            onClick={(e) => {
              const dataset = e.currentTarget.dataset;
              dataset.fold = dataset.fold === "true" ? "false" : "true";
            }}
          >
            {artistItem?.description}
          </div>
        </Condition>
      </div>
    </div>
  );
}
