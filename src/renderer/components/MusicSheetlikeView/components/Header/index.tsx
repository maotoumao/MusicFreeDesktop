import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";
import "./index.scss";
import Tag from "@/renderer/components/Tag";
import Condition, { IfTruthy } from "@/renderer/components/Condition";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import trackPlayer from "@renderer/core/track-player";
import SvgAsset from "@renderer/components/SvgAsset";
import { showModal } from "@renderer/components/Modal";

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
                alt={musicSheet?.title}></img>
            <div className="sheet-info-container">
                <div className="title-container">
                    {(musicSheet?.platform && !hidePlatform) ? (
                        <Tag>{musicSheet?.platform}</Tag>
                    ) : null}

                    <div className="title">
                        {musicSheet?.title ?? t("media.unknown_title")}
                    </div>

                </div>

                <Condition condition={musicSheet?.description}>
                    <div
                        className="info-container description-container"
                        data-fold="true"
                        title={musicSheet?.description}
                        onClick={(e) => {
                            const dataset = e.currentTarget.dataset;
                            dataset.fold = dataset.fold === "true" ? "false" : "true";
                        }}
                    >
                        {t("media.media_description")}： {musicSheet?.description}
                    </div>
                </Condition>

                <Condition condition={musicSheet?.createAt || musicSheet?.playCount}>
                    <div className="info-container">
                        <IfTruthy condition={musicSheet?.playCount}>
                            <span>{t("media.media_play_count")} {musicSheet?.playCount}</span>
                        </IfTruthy>

                        <IfTruthy condition={musicSheet?.createAt}>
                            <span>{t("media.media_create_at")} {dayjs(musicSheet?.createAt).format("YYYY-MM-DD")}</span>
                        </IfTruthy>
                    </div>
                </Condition>

                <Condition condition={musicSheet?.artist}>
                    <div className="info-container">
                        <span>{t("media.media_type_artist")} {musicSheet?.artist}</span>
                    </div>
                </Condition>
            </div>


        </div>
    );
}
