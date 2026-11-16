import {
    getMediaPrimaryKey,
    getQualityOrder,
    isSameMedia,
    setInternalData,
} from "@/common/media-util";
import * as Comlink from "comlink";
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
import { getGlobalContext } from "@/shared/global-context/renderer";
import Store from "@/common/store";
import { useEffect, useState } from "react";
import { DownloadEvts, ee } from "./ee";
import AppConfig from "@shared/app-config/renderer";
import PluginManager from "@shared/plugin-manager/renderer";
import { verifyDownloadedFile } from "./verify";
import { i18n } from "@/shared/i18n/renderer";


export interface IDownloadStatus {
    state: DownloadState;
    downloaded?: number;
    total?: number;
    msg?: string;
    /** 失败原因，界面据此给出对应的提示 */
    reason?: string;
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
    setDownloadingConcurrency(AppConfig.getConfig("download.concurrency"));
}

const concurrencyLimit = 20;
const downloadingQueue = new PQueue({
    concurrency: 5,
});

function setDownloadingConcurrency(concurrency: number) {
    if (isNaN(concurrency)) {
        return;
    }
    downloadingQueue.concurrency = Math.min(
        concurrency < 1 ? 1 : concurrency,
        concurrencyLimit,
    );
}

async function startDownload(
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
) {
    if (!downloaderWorker) {
        setupDownloaderWorker();
    }

    const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
    // 过滤掉已下载的、本地音乐、任务中的音乐
    const _validMusicItems = _musicItems.filter(
        (it) => !isDownloaded(it) && it.platform !== localPluginName,
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

            downloadingProgress.get(pk).state = DownloadState.DOWNLOADING;
            const fileName = `${it.title}-${it.artist}`.replace(/[/|\\?*"<>:]/g, "_");
            await new Promise<void>((resolve) => {
                downloadMusicImpl(it, fileName, (stateData) => {
                    downloadingProgress.set(pk, stateData);
                    ee.emit(DownloadEvts.DownloadStatusUpdated, it, stateData);
                    if (stateData.state === DownloadState.DONE) {
                        downloadingMusicStore.setValue((prev) =>
                            prev.filter((di) => !isSameMedia(it, di)),
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
    onStateChange: IOnStateChangeFunc,
) {
    const [defaultQuality, whenQualityMissing] = [
        AppConfig.getConfig("download.defaultQuality"),
        AppConfig.getConfig("download.whenQualityMissing"),
    ];
    const qualityOrder = getQualityOrder(defaultQuality, whenQualityMissing);
    let mediaSource: IPlugin.IMediaSourceResult | null = null;
    let realQuality: IMusic.IQualityKey = qualityOrder[0];
    for (const quality of qualityOrder) {
        try {
            mediaSource = await PluginManager.callPluginDelegateMethod(
                musicItem,
                "getMediaSource",
                musicItem,
                quality,
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
        AppConfig.getConfig("download.path") ??
        getGlobalContext().appPath.downloads;
            const downloadPath = window.path.resolve(
                downloadBasePath,
                `./${fileName}.${ext}`,
            );
            downloaderWorker.downloadFile(
                mediaSource,
                downloadPath,
                Comlink.proxy(async (dataState) => {
                    if (dataState.state === DownloadState.ERROR && dataState.reason) {
                        // worker 那边只认得字节数，翻译成人话交给界面
                        onStateChange({
                            ...dataState,
                            msg: i18n.t(
                                dataState.reason === "timeout"
                                    ? "download_page.download_timeout"
                                    : "download_page.incomplete_file",
                            ),
                        });
                        return;
                    }
                    if (dataState.state === DownloadState.DONE) {
                        // 服务器可能只给一小段，字节数还完全对得上 ——
                        // 量一下实际时长，明显短于标称时长就说明没下全。
                        // 这不算下载失败（有些音源本来就只给试听片段），
                        // 但这个文件不能拿去播，播放时会改用在线音源。
                        const complete = await verifyDownloadedFile(
                            downloadPath,
                            musicItem.duration,
                        );
                        onStateChange(dataState);
                        addDownloadedMusicToList(
                            setInternalData<IMusic.IMusicItemInternalData>(
                                musicItem as any,
                                "downloadData",
                                {
                                    path: downloadPath,
                                    quality: realQuality,
                                    incomplete: complete ? undefined : true,
                                },
                                true,
                            ) as IMusic.IMusicItem,
                        );
                        return;
                    }
                    onStateChange(dataState);
                }),
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

/**
 * 通用的文件下载，MV 视频这类非歌曲资源走这里。
 * 传进来的 url 最好是已经处理好请求头的地址（本地转发服务）。
 */
async function downloadFileToDisk(
    mediaSource: IMusic.IMusicSource,
    filePath: string,
    onStateChange: (status: IDownloadStatus) => void,
): Promise<void> {
    if (!downloaderWorker) {
        setupDownloaderWorker();
    }
    return new Promise<void>((resolve) => {
        downloaderWorker.downloadFile(
            mediaSource,
            filePath,
            Comlink.proxy((dataState) => {
                onStateChange(dataState);
                if (
                    dataState.state === DownloadState.DONE ||
                    dataState.state === DownloadState.ERROR
                ) {
                    resolve();
                }
            }),
        );
    });
}

function useDownloadStatus(musicItem: IMusic.IMusicItem) {
    const [downloadStatus, setDownloadStatus] = useState<IDownloadStatus | null>(
        null,
    );

    useEffect(() => {
        setDownloadStatus(
            downloadingProgress.get(getMediaPrimaryKey(musicItem)) || null,
        );

        const updateFn = (mi: IMusic.IMusicItem, stateData: IDownloadStatus) => {
            if (isSameMedia(mi, musicItem)) {
                setDownloadStatus(stateData);
            }
        };

        ee.on(DownloadEvts.DownloadStatusUpdated, updateFn);

        return () => {
            ee.off(DownloadEvts.DownloadStatusUpdated, updateFn);
        };
    }, [musicItem]);

    return downloadStatus;
}

// 下载状态
function useDownloadState(musicItem: IMusic.IMusicItem) {
    const musicStatus = useDownloadStatus(musicItem);
    const downloaded = useDownloaded(musicItem);

    return (
        musicStatus?.state || (downloaded ? DownloadState.DONE : DownloadState.NONE)
    );
}

const Downloader = {
    setupDownloader,
    startDownload,
    downloadFileToDisk,
    useDownloadStatus,
    useDownloadingMusicList: downloadingMusicStore.useValue,
    useDownloaded,
    isDownloaded,
    useDownloadedMusicList,
    removeDownloadedMusic,
    setDownloadingConcurrency,
    useDownloadState,
};
export default Downloader;
