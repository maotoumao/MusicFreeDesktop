import { isSameMedia } from "@/common/media-util";
import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
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

  const taskStatus = Downloader.useDownloadTaskStatus(musicItem);
  const downloadState = taskStatus?.status;

  const { t } = useTranslation();
  const isDownloadedOrLocal =
    downloadState === DownloadState.DONE ||
    musicItem?.platform === localPluginName;

  let iconName: SvgAssetIconNames = "array-download-tray";

  if (isDownloadedOrLocal) {
    iconName = "check-circle";
  } else if (
    taskStatus?.status && taskStatus.status !== DownloadState.NONE &&
    taskStatus.status !== DownloadState.ERROR
  ) {
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
        if (
          musicItem && (taskStatus?.status === DownloadState.NONE ||
            taskStatus?.status === DownloadState.ERROR || !taskStatus)
        ) {
          Downloader.download(musicItem);
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
