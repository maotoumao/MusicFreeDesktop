// src/renderer/core/downloader/index.new.ts
import path from 'path';
import * as Comlink from "comlink";
import {getGlobalContext} from "@shared/global-context/renderer";
import AppConfig from "@shared/app-config/renderer";
import {
    addDownloadedMusicToList,
    isDownloaded,
    setupDownloadedMusicList
} from "@renderer/core/downloader/downloaded-sheet";
import logger from "@shared/logger/renderer";
import PQueue from "p-queue";
import EventEmitter from "eventemitter3";
import {DownloadState, localPluginName} from "@/common/constant";
import {getQualityOrder, isSameMedia, setInternalData, getMediaPrimaryKey} from "@/common/media-util";
import {downloadingMusicStore} from "@renderer/core/downloader/store";
import PluginManager from "@shared/plugin-manager/renderer";
import { useState as reactUseState } from "react";
import { useEffect as reactUseEffect } from "react";

type ProxyMarkedFunction<T> = T &
    Comlink.ProxyMarked;


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
    error?: Error
}

class Downloader extends EventEmitter<IDownloaderEvent> {
    private worker: IDownloaderWorker;
    private static ConcurrencyLimit = 20;
    private downloadTaskQueue: PQueue;
    private currentTaskStatus: Map<string, Map<string, ITaskStatus>> = new Map();

    public isReady = false;

    constructor() {
        super();
    }

    public async setup() {
        // 1. config
        const downloadConcurrency = AppConfig.getConfig("download.concurrency");

        // 2. init worker
        const workerPath = getGlobalContext().workersPath.downloader;
        if (workerPath) {
            const worker = new Worker(workerPath);
            this.worker = Comlink.wrap(worker);
            this.isReady = true;
        } else {
            logger.logInfo("Worker path is not defined");
        }

        // 3. setup downloading queue
        this.downloadTaskQueue = new PQueue({
            concurrency: downloadConcurrency || 5,
            autoStart: false
        })

        // 4. setup musicsheet
        setupDownloadedMusicList();
    }

    public async download(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) {
        if (!this.worker) {
            await this.setup();
        }

        const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
        // 过滤掉已下载的、本地音乐、任务中的音乐
        const _validMusicItems = _musicItems.filter(
            (it) => !isDownloaded(it) && it.platform !== localPluginName
        );

        const downloadTasks = _validMusicItems.map((it) => {

            this.setTaskStatus(it, {
                status: DownloadState.WAITING
            });


            const task = async () => {
                if (!this.getTaskStatus(it)) {
                    return;
                }
                this.setTaskStatus(it, {
                    status: DownloadState.DOWNLOADING,
                    progress: {
                        currentSize: NaN,
                        totalSize: NaN
                    }
                });

                const fileName = `${it.title}-${it.artist}`.replace(/[/|\\?*"<>:]/g, "_");

                await new Promise<void>((resolve) => {
                    this.downloadMusicImpl(it, fileName, {
                        onError: (e) => {
                            this.setTaskStatus(it, {
                                status: DownloadState.ERROR,
                                error: e
                            });
                            resolve();
                        },
                        onProgress: (progress) => {
                            this.setTaskStatus(it, {
                                status: DownloadState.DOWNLOADING,
                                progress
                            })
                        },
                        onEnded: () => {
                            this.setTaskStatus(it, {
                                status: DownloadState.DONE
                            });
                            downloadingMusicStore.setValue((prev) =>
                                prev.filter((di) => !isSameMedia(it, di))
                            );
                            resolve();
                        }
                    }).catch((e) => {
                        this.setTaskStatus(it, {
                            status: DownloadState.ERROR,
                            error: e
                        });
                        resolve();
                    })

                })
            }

            task.musicItem = it;
            return task;
        })

        this.downloadTaskQueue.addAll(downloadTasks);
        downloadingMusicStore.setValue((prev) => [...prev, ..._validMusicItems]);
    }

    private async downloadMusicImpl(musicItem: IMusic.IMusicItem, fileName: string, options: IDownloadFileOptions) {
        // 1. config
        const [defaultQuality, whenQualityMissing] = [
            AppConfig.getConfig("download.defaultQuality"),
            AppConfig.getConfig("download.whenQualityMissing"),
        ];
        const downloadBasePath =
            AppConfig.getConfig("download.path") ??
            getGlobalContext().appPath.downloads;

        const qualityOrder = getQualityOrder(defaultQuality, whenQualityMissing);

        let mediaSource: IPlugin.IMediaSourceResult | null = null;
        let realQuality: IMusic.IQualityKey = qualityOrder[0];


        for (const quality of qualityOrder) {
            try {
                mediaSource = await PluginManager.callPluginDelegateMethod(
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
            } catch {
                // pass
            }
        }

        if (mediaSource?.url) {
            const ext = mediaSource.url.match(/.*\/.+\.([^./?#]+)/)?.[1] ?? "mp3";

            const downloadPath = path.resolve( // 修改: 使用导入的 path
                downloadBasePath,
                `./${fileName}.${ext}`
            );
            this.worker.downloadFileNew(
                mediaSource,
                downloadPath,
                Comlink.proxy({
                    onError(reason) {
                        options?.onError(reason);
                    },
                    onProgress(progress) {
                        options?.onProgress?.(progress);
                    },
                    onEnded() {
                        options?.onEnded?.();
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
                }),
            );
        } else {
            throw new Error("Invalid Source");
        }

    }

    public setConcurrency(concurrency: number) {
        if (this.downloadTaskQueue) {
            this.downloadTaskQueue.concurrency = Math.min(
                concurrency < 1 ? 1 : concurrency,
                Downloader.ConcurrencyLimit
            )
        }
    }

    public getTaskStatus(musicItem: IMusic.IMusicItem): ITaskStatus | null {
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

        if (taskStatus.status === DownloadState.DONE) {
            this.currentTaskStatus.get(platform)?.delete(id);
        } else {
            this.currentTaskStatus.get(platform)?.set(id, taskStatus);
        }
        this.emit(DownloaderEvent.DOWNLOAD_STATE_CHANGED, musicItem, taskStatus);
    }

    public useDownloadTaskStatus(musicItem: IMusic.IMusicItem) {
      const [status, setStatus] = useState<ITaskStatus | null>(this.getTaskStatus(musicItem));
      useEffect(() => {
        const callback = (item: IMusic.IMusicItem, newStatus: ITaskStatus) => {
          if (isSameMedia(item, musicItem)) {
            setStatus(newStatus);
          }
        };
        this.on(DownloaderEvent.DOWNLOAD_STATE_CHANGED, callback);
        // Set initial status
        setStatus(this.getTaskStatus(musicItem));
        return () => {
          this.off(DownloaderEvent.DOWNLOAD_STATE_CHANGED, callback);
        };
      }, [musicItem, this]);
      return status;
    }
}


export default new Downloader();
/**
 * useState hook for React functional components.
 * Delegates to React's useState implementation.
 */
function useState<T>(initialState: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  return reactUseState(initialState);
}
/**
 * useEffect hook for React functional components.
 * Delegates to React's useEffect implementation.
 */
function useEffect(effect: () => void | (() => void), deps: any[]) {
  return reactUseEffect(effect, deps);
}

