import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";
import "./index.scss";
import Tag from "@/renderer/components/Tag";
import dayjs from "dayjs";
import Condition from "@/renderer/components/Condition";
import { initValue, offsetHeightStore } from "../../store";
import { useRef } from "react";
import { rem } from "@/common/constant";

interface IProps {
  musicSheet: IMusic.IMusicSheetItem;
  musicList: IMusic.IMusicItem[];
}

export default function Header(props: IProps) {
  const { musicSheet, musicList } = props;
  const containerRef = useRef<HTMLDivElement>();

  return (
    <div className="music-sheetlike-view--header-container" ref={containerRef}>
      <img
        draggable={false}
        src={musicSheet?.artwork ?? albumImg}
        onError={setFallbackAlbum}
      ></img>
      <div className="sheet-info">
        <div className="title-container">
          <Tag>{musicSheet?.platform}</Tag>
          <div className="title">{musicSheet?.title ?? "未命名"}</div>
        </div>
        <Condition condition={musicSheet?.createAt || musicSheet?.artist}>
          <div className="info-container">
            <Condition condition={musicSheet?.createAt}>
              <span>
                发布时间：{dayjs(musicSheet?.createAt).format("YYYY-MM-DD")}
              </span>
            </Condition>
            <Condition condition={musicSheet?.artist}>
              <span>作者：{musicSheet?.artist}</span>
            </Condition>
          </div>
        </Condition>
        <div className="info-container">
          <Condition condition={musicSheet?.playCount}>
            <span>播放数：{musicSheet?.playCount}</span>
          </Condition>
          <span>歌曲数：{musicSheet?.worksNum ?? musicList?.length ?? 0}</span>
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
            简介：{musicSheet?.description}
          </div>
        </Condition>
      </div>
    </div>
  );
}
