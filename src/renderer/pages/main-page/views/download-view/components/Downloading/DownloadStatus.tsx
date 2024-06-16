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

  const downloadStatus = Downloader.useDownloadStatus(musicItem);
  if (!downloadStatus) {
    return <span>-</span>;
  } else if (downloadStatus.state === DownloadState.WAITING) {
    return <span>{t("download_page.waiting")}</span>;
  } else if (downloadStatus.state === DownloadState.ERROR) {
    return (
      <span style={{ color: "var(--dangerColor, #FC5F5F)" }}>
        {t("download_page.failed")}: {downloadStatus.msg}
      </span>
    );
  } else if (downloadStatus.state === DownloadState.DOWNLOADING) {
    return (
      <span
        style={{
          color: "var(--infoColor, #0A95C8)",
        }}
      >
        {normalizeFileSize(downloadStatus.downloaded ?? 0)} /{" "}
        {normalizeFileSize(downloadStatus.total ?? 0)}
      </span>
    );
  }
}

export default React.memo(DownloadStatus, (prev, curr) =>
  isSameMedia(prev.musicItem, curr.musicItem)
);
