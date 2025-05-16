// src/renderer/core/downloader/index.ts
import path from 'path';
import * as Comlink from "comlink";
import {getGlobalContext} from "@shared/global-context/renderer";
import AppConfig from "@shared/app-config/renderer";
import {
    addDownloadedMusicToList,
    isDownloaded as checkIsDownloaded, // 重命名以避免与类方法冲突
    setupDownloadedMusicList,
    useDownloaded as useDownloadedSheetState, // 重命名
    removeDownloadedMusic,
    useDownloadedMusicList as useGlobalDownloadedMusicList
} from "@renderer/core/downloader/downloaded-sheet";
import logger from "@shared/logger/renderer";
import PQueue from "p-queue";
import EventEmitter from "eventemitter3";
import {DownloadState, localPluginName} from "@/common/constant";
import {getQualityOrder, isSameMedia, setInternalData, getMediaPrimaryKey} from "@/common/media-util";
import {downloadingMusicStore} from "@renderer/core/downloader/store";
import PluginManager from "@shared/plugin-manager/renderer";
import { useState as reactUseState, useEffect as reactUseEffect } from "react"; // 保持这些导入

type ProxyMarkedFunction<T> = T & Comlink.ProxyMarked;

interface IDownloadFileOptions {
    onProgress?: (progress: ICommon.IDownloadFileSize) => void;
    onEnded?: () => void;
    onError?: (reason: Error) => void;
}

interface IDownloaderWorker {
    downloadFileNew: (mediaSource: IMusic.IMusicSource,
                      filePath: string, options?: ProxyMarkedFunction<IDownloadFileOptions>) => void
}

export enum DownloaderEvent {
    DOWNLOAD_STATE_CHANGED = "downloader:download-state-changed",
    QUEUE_UPDATED = "queue_updated",
}

interface IDownloaderEvent {
    [DownloaderEvent.DOWNLOAD_STATE_CHANGED]: (musicItem: IMusic.IMusicItem, status: ITaskStatus) => void;
    [DownloaderEvent.QUEUE_UPDATED]: (queue: IMusic.IMusicItem[]) => void;
}

interface ITaskStatus {
    status: DownloadState,
    progress?: ICommon.IDownloadFileSize,
    error?: Error,
    ['mediaSource']?: IPlugin.IMediaSourceResult;
    ['realQuality']?: IMusic.IQualityKey;
}

class Downloader extends EventEmitter<IDownloaderEvent> {
    private worker: IDownloaderWorker;
    private static ConcurrencyLimit = 20;
    private downloadTaskQueue: PQueue;
    private currentTaskStatus: Map<string, Map<string, ITaskStatus>> = new Map();
    public isReady = false;

    constructor() {
        super();
        this.on(DownloaderEvent.DOWNLOAD_STATE_CHANGED, (musicItem, taskStatus) => {
            // console.log("DOWNLOAD STATE CHANGE", getMediaPrimaryKey(musicItem), taskStatus.status);
        });
    }

    public async setup() {
        if (this.isReady) return;
        const downloadConcurrency = AppConfig.getConfig("download.concurrency");
        const workerPath = getGlobalContext().workersPath.downloader;
        if (workerPath) {
            try {
                const worker = new Worker(workerPath);
                this.worker = Comlink.wrap(worker);
                this.isReady = true;
                logger.logInfo("Downloader worker initialized.");
            } catch (e) {
                logger.logError("Failed to initialize downloader worker", e as Error);
                this.isReady = false;
            }
        } else {
            logger.logInfo("Downloader worker path is not defined. Downloads will not function.");
            this.isReady = false;
        }
        this.downloadTaskQueue = new PQueue({
            concurrency: downloadConcurrency || 5,
            autoStart: true
        });
        await setupDownloadedMusicList();
        logger.logInfo("Downloader setup complete.");
    }

    public async download(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) {
        if (!this.isReady || !this.worker) {
            logger.logError("Downloader not ready or worker not available. Attempting setup...", new Error("Downloader not ready or worker not available."));
            await this.setup();
            if (!this.isReady || !this.worker) {
                logger.logError("Downloader setup failed. Download cancelled for items:", new Error(JSON.stringify(musicItems)));
                return;
            }
        }
        const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
        const itemsToQueue: IMusic.IMusicItem[] = [];
        for (const it of _musicItems) {
            if (checkIsDownloaded(it) || it.platform === localPluginName) {
                logger.logInfo(`Skipping download for already downloaded or local item: ${it.title}`);
                continue;
            }
            const existingTaskStatus = this.getTaskStatus(it);
            if (existingTaskStatus && (existingTaskStatus.status === DownloadState.WAITING || existingTaskStatus.status === DownloadState.DOWNLOADING)) {
                logger.logInfo(`Skipping download for item already in queue or downloading: ${it.title}`);
                continue;
            }
            itemsToQueue.push(it);
        }
        if (itemsToQueue.length === 0) {
            logger.logInfo("No new valid music items to download.");
            return;
        }
        downloadingMusicStore.setValue((prev) => {
            const newItems = itemsToQueue.filter(newItem => !prev.find(p => isSameMedia(p, newItem)));
            return [...prev, ...newItems];
        });
        const downloadTasks = itemsToQueue.map((it) => {
            this.setTaskStatus(it, { status: DownloadState.WAITING });
            const task = async () => {
                const currentStatus = this.getTaskStatus(it);
                if (!currentStatus || (currentStatus.status !== DownloadState.WAITING && currentStatus.status !== DownloadState.ERROR)) {
                    logger.logInfo(`Download task for ${it.title} skipped due to invalid state: ${currentStatus?.status}`);
                    if (currentStatus?.status !== DownloadState.ERROR && currentStatus?.status !== DownloadState.NONE) {
                        downloadingMusicStore.setValue((prev) => prev.filter((di) => !isSameMedia(it, di)));
                    }
                    return;
                }
                this.setTaskStatus(it, { status: DownloadState.DOWNLOADING, progress: { currentSize: 0, totalSize: 0 } });
                const fileName = `${it.title}-${it.artist}`.replace(/[/|\\?*"<>:]/g, "_");
                await new Promise<void>((resolve) => {
                    this.downloadMusicImpl(it, fileName, {
                        onError: (e) => {
                            this.setTaskStatus(it, { status: DownloadState.ERROR, error: e });
                            resolve();
                        },
                        onProgress: (progress) => {
                            if (this.getTaskStatus(it)?.status === DownloadState.DOWNLOADING) {
                                this.setTaskStatus(it, { status: DownloadState.DOWNLOADING, progress });
                            }
                        },
                        onEnded: async () => {
                            const taskStatusInfo = this.getTaskStatus(it);
                            const mediaSource = taskStatusInfo?.['mediaSource'] as IPlugin.IMediaSourceResult | undefined;
                            const realQuality = taskStatusInfo?.['realQuality'] as IMusic.IQualityKey | undefined;
                            const downloadBasePath = AppConfig.getConfig("download.path") ?? getGlobalContext().appPath.downloads;
                            const ext = mediaSource?.url?.match(/.*\/.+\.([^./?#]+)/)?.[1] ?? "mp3";
                            const downloadPath = path.resolve(downloadBasePath, `./${fileName}.${ext}`);
                            const musicItemWithDownloadData = setInternalData<IMusic.IMusicItemInternalData>(it, "downloadData", { path: downloadPath, quality: realQuality || AppConfig.getConfig("download.defaultQuality"), }, true) as IMusic.IMusicItem;
                            await addDownloadedMusicToList(musicItemWithDownloadData);
                            this.setTaskStatus(it, { status: DownloadState.DONE });
                            downloadingMusicStore.setValue((prev) => prev.filter((di) => !isSameMedia(it, di)));
                            resolve();
                        }
                    }).catch((e) => {
                        logger.logError(`Error during downloadMusicImpl for ${it.title}`, e as Error);
                        this.setTaskStatus(it, { status: DownloadState.ERROR, error: e instanceof Error ? e : new Error(String(e)) });
                        resolve();
                    });
                });
            };
            return task;
        });
        this.downloadTaskQueue.addAll(downloadTasks).catch(error => {
            logger.logError("Error adding tasks to download queue", error);
        });
    }

    private async downloadMusicImpl(musicItem: IMusic.IMusicItem, fileName: string, options: IDownloadFileOptions) {
        const [defaultQuality, whenQualityMissing] = [AppConfig.getConfig("download.defaultQuality"), AppConfig.getConfig("download.whenQualityMissing"),];
        const downloadBasePath = AppConfig.getConfig("download.path") ?? getGlobalContext().appPath.downloads;
        const qualityOrder = getQualityOrder(defaultQuality, whenQualityMissing);
        let mediaSource: IPlugin.IMediaSourceResult | null = null;
        let realQuality: IMusic.IQualityKey = qualityOrder[0];
        for (const quality of qualityOrder) {
            try {
                const source = await PluginManager.callPluginDelegateMethod(musicItem, "getMediaSource", musicItem, quality);
                if (!source?.url) continue;
                mediaSource = source;
                realQuality = quality;
                const taskStatus = this.getTaskStatus(musicItem) || { status: DownloadState.DOWNLOADING };
                this.setTaskStatus(musicItem, { ...taskStatus, ['mediaSource']: mediaSource, ['realQuality']: realQuality, });
                break;
            } catch(e) {
                logger.logError(`Failed to get media source for ${musicItem.title} (quality: ${quality})`, e as Error);
            }
        }
        if (mediaSource?.url) {
            const ext = mediaSource.url.match(/.*\/.+\.([^./?#]+)/)?.[1] ?? "mp3";
            const downloadPath = path.resolve(downloadBasePath, `./${fileName}.${ext}`);
            if (!this.worker) {
                logger.logError("Downloader worker is not available in downloadMusicImpl.", new Error("Downloader worker not available."));
                options.onError?.(new Error("Downloader worker not available."));
                return;
            }
            this.worker.downloadFileNew(mediaSource, downloadPath, Comlink.proxy({
                onError(reason) { options?.onError?.(reason); },
                onProgress(progress) { options?.onProgress?.(progress); },
                onEnded() { options?.onEnded?.(); }
            }));
        } else {
            const error = new Error("Invalid Source: No valid media URL found after trying all qualities.");
            logger.logError(error.message, error);
            options.onError?.(error);
        }
    }

    public setConcurrency(concurrency: number) {
        if (this.downloadTaskQueue) {
            this.downloadTaskQueue.concurrency = Math.max(1, Math.min(concurrency, Downloader.ConcurrencyLimit));
        }
    }

    public getTaskStatus(musicItem: IMusic.IMusicItem): ITaskStatus | null {
        if (!musicItem) return null;
        const platform = "" + musicItem.platform;
        const id = "" + musicItem.id;
        return this.currentTaskStatus.get(platform)?.get(id) ?? null;
    }

    private setTaskStatus(musicItem: IMusic.IMusicItem, taskStatus: ITaskStatus) {
        const platform = "" + musicItem.platform;
        const id = "" + musicItem.id;
        if (!this.currentTaskStatus.has(platform)) {
            this.currentTaskStatus.set(platform, new Map());
        }
        this.currentTaskStatus.get(platform)?.set(id, taskStatus);
        this.emit(DownloaderEvent.DOWNLOAD_STATE_CHANGED, musicItem, taskStatus);
    }

    public useDownloadTaskStatus(musicItem: IMusic.IMusicItem | null) {
      const [status, setStatus] = reactUseState<ITaskStatus | null>(musicItem ? this.getTaskStatus(musicItem) : null);
      reactUseEffect(() => {
        if (!musicItem) {
            setStatus(null);
            return;
        }
        const callback = (item: IMusic.IMusicItem, newStatus: ITaskStatus) => {
          if (isSameMedia(item, musicItem)) {
            setStatus(newStatus);
          }
        };
        setStatus(this.getTaskStatus(musicItem));
        this.on(DownloaderEvent.DOWNLOAD_STATE_CHANGED, callback);
        return () => {
          this.off(DownloaderEvent.DOWNLOAD_STATE_CHANGED, callback);
        };
      }, [musicItem, this]);
      return status;
    }

    public getDownloadingMusicList() {
        return downloadingMusicStore.getValue();
    }

    public useDownloadingMusicList() {
        return downloadingMusicStore.useValue();
    }
}

const downloaderInstance = new Downloader();

function useDownloadStateHook(musicItem: IMusic.IMusicItem | null): DownloadState {
    const taskStatus = downloaderInstance.useDownloadTaskStatus(musicItem);
    const downloaded = useDownloadedSheetState(musicItem);
    if (downloaded) return DownloadState.DONE;
    if (taskStatus) return taskStatus.status;
    return DownloadState.NONE;
}

// ++ 新增: 定义导出对象的接口类型 ++
export interface DownloaderService {
    setup: () => Promise<void>;
    download: (items: IMusic.IMusicItem | IMusic.IMusicItem[]) => Promise<void>;
    setConcurrency: (concurrency: number) => void;
    useDownloadTaskStatus: (item: IMusic.IMusicItem | null) => ITaskStatus | null;
    useDownloadingMusicList: () => IMusic.IMusicItem[];
    getDownloadingMusicList: () => IMusic.IMusicItem[];
    isDownloaded: typeof checkIsDownloaded;
    useDownloaded: typeof useDownloadedSheetState;
    removeDownloadedMusic: typeof removeDownloadedMusic;
    useDownloadedMusicList: typeof useGlobalDownloadedMusicList;
    useDownloadState: (musicItem: IMusic.IMusicItem | null) => DownloadState;
}
// -- 新增 --

// ++ 修改: 使导出的对象符合新定义的接口 ++
const downloaderServiceMethods: DownloaderService = {
    setup: () => downloaderInstance.setup(),
    download: (items) => downloaderInstance.download(items),
    setConcurrency: (concurrency) => downloaderInstance.setConcurrency(concurrency),
    useDownloadTaskStatus: (item) => downloaderInstance.useDownloadTaskStatus(item),
    useDownloadingMusicList: () => downloaderInstance.useDownloadingMusicList(),
    getDownloadingMusicList: () => downloaderInstance.getDownloadingMusicList(),
    isDownloaded: checkIsDownloaded,
    useDownloaded: useDownloadedSheetState,
    removeDownloadedMusic,
    useDownloadedMusicList: useGlobalDownloadedMusicList,
    useDownloadState: useDownloadStateHook,
};

export default downloaderServiceMethods;
// -- 修改 --