// src/renderer/components/MusicDownloaded/index.tsx
import React from 'react';
import SvgAsset from "@/renderer/components/SvgAsset";
// ++ 修改: 同时导入服务和它的类型 ++
import downloaderService, { DownloaderService } from "@/renderer/core/downloader";
// -- 修改 --
import { DownloadState } from "@/common/constant";
import "./index.scss";

interface IMusicDownloadedProps {
  musicItem: IMusic.IMusicItem | null;
  size?: number;
}

export default function MusicDownloaded(props: IMusicDownloadedProps) {
  const { musicItem, size = 18 } = props;

  // ++ 修改: 可以选择显式地为 service 变量指定类型，以获得更好的类型提示和检查 ++
  const service: DownloaderService = downloaderService;
  const downloadState = service.useDownloadState(musicItem); // 使用 typed service
  // -- 修改 --

  if (!musicItem) {
    return null;
  }

  const isActuallyDownloaded = downloadState === DownloadState.DONE;

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (musicItem && downloadState !== DownloadState.DOWNLOADING && downloadState !== DownloadState.WAITING) {
      service.download(musicItem); // 使用 typed service
    }
  };

  return (
    <div
      className={`music-download-base ${
        isActuallyDownloaded ? 'music-downloaded' : (downloadState === DownloadState.NONE || downloadState === DownloadState.ERROR) ? 'music-can-download' : ''
      }`}
      style={{ width: size, height: size }}
      role="button"
      onClick={handleDownloadClick}
      title={isActuallyDownloaded ? "已下载" : (downloadState === DownloadState.DOWNLOADING || downloadState === DownloadState.WAITING) ? "下载中..." : "下载"}
    >
      <SvgAsset
        iconName={
          isActuallyDownloaded
            ? "check-circle"
            : (downloadState === DownloadState.DOWNLOADING || downloadState === DownloadState.WAITING)
            ? "rolling-1s"
            : "array-download-tray"
        }
        size={size}
      />
    </div>
  );
}