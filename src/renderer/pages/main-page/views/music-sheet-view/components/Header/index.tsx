import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import musicSheetStore from "../../store/musicSheetStore";
import albumImg from "@/assets/imgs/album-cover.jpg";
import "./index.scss";
import Tag from "@/renderer/components/Tag";
import dayjs from "dayjs";
import Condition from "@/renderer/components/Condition";

interface IProps {
  musicSheet: IMusic.IMusicSheetItem;
}

export default function Header(props: IProps) {
  const { musicSheet } = props;
  console.log('mssss', musicSheet);

  return (
    <div className="music-sheet-view--header-container">
      <img
        draggable={false}
        src={musicSheet?.artwork ?? albumImg}
        onError={setFallbackAlbum}
      ></img>
      <div className="sheet-info">
        <div className="title-container">
          <Tag>{musicSheet?.platform}</Tag>
          <div className="title">{musicSheet?.title ?? "未命名歌单"}</div>
        </div>
        <Condition condition={musicSheet?.createAt || musicSheet?.artist}>
          <div className="info-container">
            <Condition condition={musicSheet?.createAt}>
              <span>
                创建时间：{dayjs(musicSheet?.createAt).format("YYYY-MM-DD")}
              </span>
            </Condition>
            <Condition condition={musicSheet?.artist}>
              <span>创建者：{musicSheet?.artist}</span>
            </Condition>
          </div>
        </Condition>
        <div className="info-container">
          <Condition condition={musicSheet?.playCount}>
            <span>播放数：{musicSheet?.playCount}</span>
          </Condition>
          <span>
            歌曲数：{musicSheet?.worksNum ?? musicSheet?.musicList?.length ?? 0}
          </span>
        </div>

        <Condition condition={musicSheet?.description}>
          <div
            className="info-container description-container"
            data-fold="true"
          >
            简介：{musicSheet?.description}
          </div>
        </Condition>
      </div>
    </div>
  );
}
