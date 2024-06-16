import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";
import "./index.scss";
import Tag from "@/renderer/components/Tag";
import dayjs from "dayjs";
import Condition from "@/renderer/components/Condition";
import { offsetHeightStore } from "../../store";
import { useRef } from "react";
import { rem } from "@/common/constant";
import { useTranslation } from "react-i18next";

interface IProps {
  musicSheet: IMusic.IMusicSheetItem;
  musicList: IMusic.IMusicItem[];
  hidePlatform?: boolean;
}

export default function Header(props: IProps) {
  const { musicSheet, musicList, hidePlatform } = props;
  const containerRef = useRef<HTMLDivElement>();
  const { t } = useTranslation();

  return (
    <div className="music-sheetlike-view--header-container" ref={containerRef}>
      <img
        draggable={false}
        src={musicSheet?.artwork ?? musicSheet?.coverImg ?? albumImg}
        onError={setFallbackAlbum}
      ></img>
      <div className="sheet-info">
        <div className="title-container">
          {musicSheet?.platform && !hidePlatform ? (
            <Tag>{musicSheet?.platform}</Tag>
          ) : null}

          <div className="title">
            {musicSheet?.title ?? t("media.unknown_title")}
          </div>
        </div>
        <Condition condition={musicSheet?.createAt || musicSheet?.artist}>
          <div className="info-container">
            <Condition condition={musicSheet?.createAt}>
              <span>
                {t("media.media_create_at")}:{" "}
                {dayjs(musicSheet?.createAt).format("YYYY-MM-DD")}
              </span>
            </Condition>
            <Condition condition={musicSheet?.artist}>
              <span>
                {t("media.media_type_artist")}: {musicSheet?.artist}
              </span>
            </Condition>
          </div>
        </Condition>
        <div className="info-container">
          <Condition condition={musicSheet?.playCount}>
            <span>
              {t("media.media_play_count")}: {musicSheet?.playCount}
            </span>
          </Condition>
          <span>
            {t("media.media_music_count")}:{" "}
            {musicSheet?.worksNum ?? musicList?.length ?? 0}
          </span>
        </div>

        <Condition condition={musicSheet?.description}>
          <div
            className="info-container description-container"
            data-fold="true"
            title={musicSheet?.description}
            onClick={(e) => {
              const dataset = e.currentTarget.dataset;

              dataset.fold = dataset.fold === "true" ? "false" : "true";
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  offsetHeightStore.setValue(
                    containerRef.current.offsetTop +
                      containerRef.current.clientHeight +
                      4 * rem
                  );
                });
              });
            }}
          >
            {t("media.media_description")}： {musicSheet?.description}
          </div>
        </Condition>
      </div>
    </div>
  );
}
