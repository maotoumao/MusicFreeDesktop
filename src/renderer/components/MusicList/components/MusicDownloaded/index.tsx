import { isSameMedia } from "@/common/media-util";
import SvgAsset from "@/renderer/components/SvgAsset";
import { useDownloaded } from "@/renderer/core/downloader/downloaded-sheet";
import { memo } from "react";
import "./index.scss";
import { localPluginName } from "@/common/constant";
import Downloader from "@/renderer/core/downloader";

interface IMusicDownloadedProps {
  musicItem: IMusic.IMusicItem;
}

function MusicDownloaded(props: IMusicDownloadedProps) {
  const { musicItem } = props;

  const isDownloaded = useDownloaded(musicItem);
  const isDownloadedOrLocal =
    isDownloaded || musicItem.platform === localPluginName;

  return (
    <div
      className={
        isDownloadedOrLocal ? "music-downloaded" : "music-can-download"
      }
      title={isDownloadedOrLocal ? "已下载" : "下载"}
      onClick={() => {
        if (!isDownloadedOrLocal) {
          // TODO 点击的时候切换loading状态
          Downloader.generateDownloadMusicTask(musicItem);
        }
      }}
    >
      <SvgAsset
        iconName={isDownloadedOrLocal ? "check" : "array-download-tray"}
        size={18}
      ></SvgAsset>
    </div>
  );
}

export default memo(MusicDownloaded, (prev, curr) =>
  isSameMedia(prev.musicItem, curr.musicItem)
);
