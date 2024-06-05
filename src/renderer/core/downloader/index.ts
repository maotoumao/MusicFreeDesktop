import {
  getMediaPrimaryKey,
  getQualityOrder,
  isSameMedia,
  setInternalData,
} from "@/common/media-util";
import * as Comlink from "comlink";
import { callPluginDelegateMethod } from "../plugin-delegate";
import { DownloadState, localPluginName } from "@/common/constant";
import PQueue from "p-queue";
import {
  addDownloadedMusicToList,
  isDownloaded,
  removeDownloadedMusic,
  setupDownloadedMusicList,
  useDownloaded,
  useDownloadedMusicList,
} from "./downloaded-sheet";
import { getAppConfigPath } from "@/shared/app-config/renderer";
import { getGlobalContext } from "@/shared/global-context/renderer";
import EventEmitter from "eventemitter3";
import Store from "@/common/store";
import { useEffect, useState } from "react";

export interface IDownloadStatus {
  state: DownloadState;
  downloaded?: number;
  total?: number;
  msg?: string;
}

const downloadingMusicStore = new Store<Array<IMusic.IMusicItem>>([]);
const downloadingProgress = new Map<string, IDownloadStatus>();

type ProxyMarkedFunction<T extends (...args: any) => void> = T &
  Comlink.ProxyMarked;

type IOnStateChangeFunc = (data: IDownloadStatus) => void;

interface IDownloaderWorker {
  downloadFile: (
    mediaSource: IMusic.IMusicSource,
    filePath: string,
    onStateChange: ProxyMarkedFunction<IOnStateChangeFunc>
  ) => Promise<void>;
}

let downloaderWorker: IDownloaderWorker;

const ee = new EventEmitter();

async function setupDownloader() {
  setupDownloaderWorker();
  setupDownloadedMusicList();
}

function setupDownloaderWorker() {
  // 初始化worker
  const downloaderWorkerPath = getGlobalContext().workersPath.downloader;
  if (downloaderWorkerPath) {
    const worker = new Worker(downloaderWorkerPath);
    downloaderWorker = Comlink.wrap(worker);
  }
  setDownloadingConcurrency(getAppConfigPath("download.concurrency"));
}

const concurrencyLimit = 20;
const downloadingQueue = new PQueue({
  concurrency: 5,
});

function setDownloadingConcurrency(concurrency: number) {
  downloadingQueue.concurrency = Math.min(
    concurrency < 1 ? 1 : concurrency,
    concurrencyLimit
  );
}

async function startDownload(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  if (!downloaderWorker) {
    setupDownloaderWorker();
  }

  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  // 过滤掉已下载的、本地音乐、任务中的音乐
  const _validMusicItems = _musicItems.filter(
    (it) => !isDownloaded(it) && it.platform !== localPluginName
  );

  const downloadCallbacks = _validMusicItems.map((it) => {
    const pk = getMediaPrimaryKey(it);
    downloadingProgress.set(pk, {
      state: DownloadState.WAITING,
    });

    return async () => {
      // Not on waiting list
      if (!downloadingProgress.has(pk)) {
        return;
      }

      downloadingProgress.get(pk).state = DownloadState.PENDING;
      const fileName = `${it.title}-${it.artist}`.replace(/[/|\\?*"<>:]/g, "_");
      await new Promise<void>((resolve) => {
        downloadMusicImpl(it, fileName, (stateData) => {
          downloadingProgress.set(pk, stateData);
          console.log("State update", stateData);
          ee.emit("DownloadUpdated", it, stateData);
          if (stateData.state === DownloadState.DONE) {
            downloadingMusicStore.setValue((prev) =>
              prev.filter((di) => !isSameMedia(it, di))
            );
            downloadingProgress.delete(pk);
            resolve();
          } else if (stateData.state === DownloadState.ERROR) {
            resolve();
          }
        });
      });
    };
  });

  downloadingMusicStore.setValue((prev) => [...prev, ..._validMusicItems]);
  downloadingQueue.addAll(downloadCallbacks);
}

async function downloadMusicImpl(
  musicItem: IMusic.IMusicItem,
  fileName: string,
  onStateChange: IOnStateChangeFunc
) {
  const [defaultQuality, whenQualityMissing] = [
    getAppConfigPath("download.defaultQuality"),
    getAppConfigPath("download.whenQualityMissing"),
  ];
  const qualityOrder = getQualityOrder(defaultQuality, whenQualityMissing);
  let mediaSource: IPlugin.IMediaSourceResult | null = null;
  let realQuality: IMusic.IQualityKey = qualityOrder[0];
  for (const quality of qualityOrder) {
    try {
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
      const ext = mediaSource.url.match(/.*\/.+\.([^./?#]+)/)?.[1] ?? "mp3";
      const downloadBasePath =
        getAppConfigPath("download.path") ??
        getGlobalContext().appPath.downloads;
      const downloadPath = window.path.resolve(
        downloadBasePath,
        `./${fileName}.${ext}`
      );
      downloaderWorker.downloadFile(
        mediaSource,
        downloadPath,
        Comlink.proxy((dataState) => {
          onStateChange(dataState);
          if (dataState.state === DownloadState.DONE) {
            addDownloadedMusicToList(
              setInternalData<IMusic.IMusicItemInternalData>(
                musicItem as any,
                "downloadData",
                {
                  path: downloadPath,
                  quality: realQuality,
                },
                true
              ) as IMusic.IMusicItem
            );
          }
        })
      );
    } else {
      throw new Error("Invalid Source");
    }
  } catch (e) {
    console.log(e, "ERROR");
    onStateChange({
      state: DownloadState.ERROR,
      msg: e?.message,
    });
  }
}

function useDownloadStatus(musicItem: IMusic.IMusicItem) {
  const [downloadStatus, setDownloadStatus] = useState<IDownloadStatus | null>(
    null
  );

  useEffect(() => {
    setDownloadStatus(
      downloadingProgress.get(getMediaPrimaryKey(musicItem)) || null
    );

    const updateFn = (mi: IMusic.IMusicItem, stateData: IDownloadStatus) => {
      if (isSameMedia(mi, musicItem)) {
        setDownloadStatus(stateData);
      }
    };

    ee.on("DownloadUpdated", updateFn);

    return () => {
      ee.off("DownloadUpdated", updateFn);
    };
  }, [musicItem]);

  return downloadStatus;
}

const Downloader = {
  setupDownloader,
  startDownload,
  useDownloadStatus,
  useDownloadingMusicList: downloadingMusicStore.useValue,
  useDownloaded,
  isDownloaded,
  useDownloadedMusicList,
  removeDownloadedMusic,
  setDownloadingConcurrency,
};
export default Downloader;
