import { isSameMedia } from "@/common/media-util";
import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import { useDownloaded } from "@/renderer/core/downloader/downloaded-sheet";
import { memo, useEffect, useState } from "react";
import "./index.scss";
import { DownloadState, localPluginName } from "@/common/constant";
import Downloader from "@/renderer/core/downloader";
import { useTranslation } from "react-i18next";

interface IMusicDownloadedProps {
  musicItem: IMusic.IMusicItem;
  size?: number;
}

function MusicDownloaded(props: IMusicDownloadedProps) {
  const { musicItem, size = 18 } = props;
  // const [loading, setLoading] = useState(false);

  const downloadState = Downloader.useDownloadState(musicItem);

  console.log("d", downloadState);

  const { t } = useTranslation();
  const isDownloadedOrLocal =
    downloadState === DownloadState.DONE ||
    musicItem?.platform === localPluginName;

  let iconName: SvgAssetIconNames = "array-download-tray";

  if (isDownloadedOrLocal) {
    iconName = "check-circle";
  } else if (downloadState !== DownloadState.NONE) {
    iconName = "rolling-1s";
  }

  return (
    <div
      className={`music-download-base ${
        isDownloadedOrLocal ? "music-downloaded" : "music-can-download"
      }`}
      title={
        isDownloadedOrLocal ? t("common.downloaded") : t("common.download")
      }
      onClick={() => {
        if (!isDownloadedOrLocal) {
          Downloader.startDownload(musicItem);
        }
      }}
    >
      <SvgAsset iconName={iconName} size={size}></SvgAsset>
    </div>
  );
}

export default memo(MusicDownloaded, (prev, curr) =>
  isSameMedia(prev.musicItem, curr.musicItem)
);
