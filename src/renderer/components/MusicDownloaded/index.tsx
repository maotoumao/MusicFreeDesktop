import { isSameMedia } from "@/common/media-util";
import SvgAsset from "@/renderer/components/SvgAsset";
import { useDownloaded } from "@/renderer/core/downloader/downloaded-sheet";
import { memo, useEffect, useState } from "react";
import "./index.scss";
import { localPluginName } from "@/common/constant";
import Downloader from "@/renderer/core/downloader";
import { useTranslation } from "react-i18next";

interface IMusicDownloadedProps {
  musicItem: IMusic.IMusicItem;
  size?: number;
}

function MusicDownloaded(props: IMusicDownloadedProps) {
  const { musicItem, size = 18 } = props;
  // const [loading, setLoading] = useState(false);

  const isDownloaded = useDownloaded(musicItem);
  const { t } = useTranslation();
  const isDownloadedOrLocal =
    isDownloaded || musicItem?.platform === localPluginName;

  // useEffect(() => {
  //   setLoading(false);
  // }, [isDownloaded]);

  return (
    <div
      className={
        isDownloadedOrLocal ? "music-downloaded" : "music-can-download"
      }
      title={
        isDownloadedOrLocal ? t("common.downloaded") : t("common.download")
      }
      onClick={() => {
        if (!isDownloadedOrLocal) {
          Downloader.startDownload(musicItem);
        }
      }}
    >
      <SvgAsset
        iconName={isDownloadedOrLocal ? "check-circle" : "array-download-tray"}
        size={size}
      ></SvgAsset>
    </div>
  );
}

export default memo(MusicDownloaded, (prev, curr) =>
  isSameMedia(prev.musicItem, curr.musicItem)
);
