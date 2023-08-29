import rendererAppConfig from "@/common/app-config/renderer";
import {
  getQualityOrder,
  isSameMedia,
  setInternalData,
} from "@/common/media-util";
import * as Comlink from "comlink";
import { callPluginDelegateMethod } from "../plugin-delegate";
import { DownloadState, localPluginName } from "@/common/constant";
import PQueue from "p-queue";
import { downloadingQueueStore } from "./store";
import throttle from "lodash.throttle";
import {
  addDownloadedMusicToList,
  isDownloaded,
  setupDownloadedMusicList,
  useDownloaded,
  useDownloadedMusicList,
} from "./downloaded-sheet";

type ProxyMarkedFunction<T extends (...args: any) => void> = T &
  Comlink.ProxyMarked;

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
  setupDownloaderWorker();
  setupDownloadedMusicList();
}

function forceUpdatePendingQueue() {
  downloadingQueueStore.setValue((prev) => [...prev]);
}

function tForceUpdatePendingQueue() {
  throttle(forceUpdatePendingQueue, 32, {
    leading: true,
    trailing: true,
  });
}

function setupDownloaderWorker() {
  // 初始化worker
  const downloaderWorkerPath = window.globalData?.workersPath?.downloader;
  if (downloaderWorkerPath) {
    const worker = new Worker(downloaderWorkerPath);
    downloaderWorker = Comlink.wrap(worker);
  }
}

const downloadingQueue = new PQueue({
  concurrency: rendererAppConfig.getAppConfigPath("download.concurrency"),
});

async function generateDownloadMusicTask(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  if (!downloaderWorker) {
    setupDownloaderWorker();
  }
  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  // 过滤掉已下载的
  const _validMusicItems = _musicItems.filter(
    (it) => !isDownloaded(it) && it.platform !== localPluginName
  );
  // @ts-ignore
  downloadingQueueStore.setValue((prev) => {
    return [
      ...prev,
      ..._validMusicItems.map(
        (mi) =>
          [
            mi,
            {
              state: DownloadState.WAITING,
            },
          ] as const
      ),
    ];
  });
  const downloadingFuncs = _validMusicItems.map((mi) => async () => {
    const queueItem = downloadingQueueStore
      .getValue()
      .find((it) => isSameMedia(it[0], mi));
    console.log(queueItem);
    if (queueItem) {
      queueItem[1] = {
        state: DownloadState.PENDING,
      };
      tForceUpdatePendingQueue();
      const fileName = `${mi.title}-${mi.artist}`;
      await new Promise<void>((resolve) => {
        downloadMusic(mi, fileName, (data) => {
          console.log(data);
          queueItem[1] = data;
          if (data.state === DownloadState.DONE) {
            downloadingQueueStore.setValue((prev) =>
              prev.filter((it) => !isSameMedia(it[0], mi))
            );
            resolve();
          } else if (data.state === DownloadState.ERROR) {
            resolve();
          }
          tForceUpdatePendingQueue();
        });
      });
    }
  });
  downloadingQueue.addAll(downloadingFuncs);
}

async function downloadMusic(
  musicItem: IMusic.IMusicItem,
  fileName: string,
  onStateChange: IOnStateChangeFunc
) {
  const [defaultQuality, whenQualityMissing] = [
    rendererAppConfig.getAppConfigPath("download.defaultQuality"),
    rendererAppConfig.getAppConfigPath("download.whenQualityMissing"),
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
        rendererAppConfig.getAppConfigPath("download.path") ??
        window.globalData.appPath.downloads;
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
    }
  } catch (e) {
    console.log("download fail", e);
  }
}

const Downloader = {
  setupDownloader,
  generateDownloadMusicTask,
  useDownloaded,
  useDownloadedMusicList,
};
export default Downloader;
