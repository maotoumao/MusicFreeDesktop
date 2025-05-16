import { DownloadState } from "@/common/constant";
import { isSameMedia } from "@/common/media-util";
import { normalizeFileSize } from "@/common/normalize-util";
import Downloader from "@/renderer/core/downloader";
import React from "react";
import { useTranslation } from "react-i18next";

interface IProps {
  musicItem: IMusic.IMusicItem;
}

function DownloadStatus(props: IProps) {
  const { musicItem } = props;

  const { t } = useTranslation();

  const taskStatus = Downloader.useDownloadTaskStatus(musicItem);
  if (!taskStatus) {
    return <span>-</span>;
  } else if (taskStatus.status === DownloadState.WAITING) {
    return <span>{t("download_page.waiting")}</span>;
  } else if (taskStatus.status === DownloadState.ERROR) {
    return (
      <span style={{ color: "var(--dangerColor, #FC5F5F)" }}>
        {t("download_page.failed")}: {taskStatus.error?.message}
      </span>
    );
  } else if (taskStatus.status === DownloadState.DOWNLOADING) {
    return (
      <span
        style={{
          color: "var(--infoColor, #0A95C8)",
        }}
      >
        {normalizeFileSize(taskStatus.progress?.currentSize ?? 0)} /{" "}
        {normalizeFileSize(taskStatus.progress?.totalSize ?? 0)}
      </span>
    );
  }
}

export default React.memo(DownloadStatus, (prev, curr) =>
  isSameMedia(prev.musicItem, curr.musicItem)
);
