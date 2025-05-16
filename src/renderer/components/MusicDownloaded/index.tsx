// src/renderer/components/MusicDownloaded/index.tsx
import { isSameMedia } from "@/common/media-util";
import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import { memo } from "react"; // 移除了 useEffect 和 useState，因为状态由 Downloader 的钩子管理
import "./index.scss";
import { DownloadState, localPluginName } from "@/common/constant";
import Downloader from "@/renderer/core/downloader";
import { useTranslation } from "react-i18next";

interface IMusicDownloadedProps {
  musicItem: IMusic.IMusicItem | null; // 允许 musicItem 为 null
  size?: number;
}

function MusicDownloaded(props: IMusicDownloadedProps) {
  const { musicItem, size = 18 } = props;
  const downloadState = Downloader.useDownloadState(musicItem); // musicItem 可能为 null

  const { t } = useTranslation();
  const isDownloadedOrLocal = musicItem && // 添加 musicItem 检查
    (downloadState === DownloadState.DONE ||
    musicItem.platform === localPluginName);

  let iconName: SvgAssetIconNames = "array-download-tray";

  if (isDownloadedOrLocal) {
    iconName = "check-circle";
  } else if (
    downloadState && // 确保 downloadState 存在 (虽然 useDownloadState 应该总是返回一个值)
    downloadState !== DownloadState.NONE &&
    downloadState !== DownloadState.ERROR
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
          musicItem && // 添加 musicItem 检查
          (downloadState === DownloadState.NONE ||
            downloadState === DownloadState.ERROR)
        ) {
          Downloader.startDownload(musicItem);
        }
      }}
    >
      <SvgAsset iconName={iconName} size={size}></SvgAsset>
    </div>
  );
}

export default memo(MusicDownloaded, (prev, curr) =>
  // isSameMedia 应该能处理 null 值，但最好确保 musicItem 的比较逻辑正确
  (prev.musicItem === null && curr.musicItem === null) ||
  (prev.musicItem !== null && curr.musicItem !== null && isSameMedia(prev.musicItem, curr.musicItem))
);