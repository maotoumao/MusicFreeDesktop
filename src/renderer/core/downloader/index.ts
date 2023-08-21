import rendererAppConfig from "@/common/app-config/renderer";
import { getQualityOrder } from "@/common/media-util";
import * as Comlink from "comlink";
import { callPluginDelegateMethod } from "../plugin-delegate";
import { DownloadState } from "@/common/constant";

type ProxyMarkedFunction<T extends (...args: any) => void> = T & Comlink.ProxyMarked;

type IOnStateChangeFunc = (data: {
  state: DownloadState;
  downloaded?: number;
  total?: number;
  msg?: string;
}) => void;

interface IDownloaderWorker {
  downloadFile: (
    mediaSource: IMusic.IMusicSource,
    filePath: string,
    onStateChange: ProxyMarkedFunction<IOnStateChangeFunc>
  ) => Promise<void>;
}

let downloaderWorker: IDownloaderWorker;
async function setupDownloader() {
  const worker = new Worker(window.globalData.workersPath.downloader);
  if (worker) {
    downloaderWorker = Comlink.wrap(worker);
  }
}

async function downloadMusic(musicItem: IMusic.IMusicItem, filePath: string) {
  if (!downloaderWorker) {
    await setupDownloader();
  }
  const [defaultQuality, whenQualityMissing] = [
    rendererAppConfig.getAppConfigPath("download.defaultQuality"),
    rendererAppConfig.getAppConfigPath("download.whenQualityMissing"),
  ];
  const qualityOrder = getQualityOrder(defaultQuality, whenQualityMissing);
  let mediaSource: IPlugin.IMediaSourceResult | null = null;
  let realQuality: IMusic.IQualityKey = qualityOrder[0];
  for (const quality of qualityOrder) {
    try {
      console.log("qq", quality);
      mediaSource = await callPluginDelegateMethod(
        musicItem,
        "getMediaSource",
        musicItem,
        quality
      );
      if (!mediaSource?.url) {
        continue;
      }
      realQuality = quality;
      break;
    } catch {}
  }
  try {
    if (mediaSource?.url) {
      console.log("download file", mediaSource);
      return await downloaderWorker.downloadFile(
        mediaSource,
        filePath,
        Comlink.proxy(async (data) => {
          console.log(data);
        }),

      );
    }
  } catch (e) {
    console.log("download fail", e);
  }
}

const Downloader = {
  downloadMusic,
};
export default Downloader;
