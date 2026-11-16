import * as Comlink from "comlink";
import fs from "fs";
import { encodeUrlHeaders } from "@/common/normalize-util";
import throttle from "lodash.throttle";
import { DownloadState as DownloadState } from "@/common/constant";
import {
    getTempFilePath,
    removeFile,
    saveResponseToFile,
} from "./download-core";

type IOnStateChangeFunc = (data: {
    state: DownloadState;
    downloaded?: number;
    total?: number;
    msg?: string;
}) => void;

/** 拼出带请求头的请求地址 */
async function requestSource(mediaSource: IMusic.IMusicSource) {
    const headers: Record<string, string> = {
        ...(mediaSource.headers ?? {}),
        "user-agent": mediaSource.userAgent,
    };
    const urlObj = new URL(mediaSource.url);
    if (urlObj.username && urlObj.password) {
        headers["Authorization"] = `Basic ${btoa(
            `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(
                urlObj.password,
            )}`,
        )}`;
        urlObj.username = "";
        urlObj.password = "";
        return fetch(urlObj.toString(), { headers });
    }
    return fetch(encodeUrlHeaders(mediaSource.url, headers));
}

async function downloadFile(
    mediaSource: IMusic.IMusicSource,
    filePath: string,
    onStateChange: IOnStateChangeFunc,
) {
    let state = DownloadState.DOWNLOADING;
    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            state = DownloadState.ERROR;
            onStateChange?.({
                state,
                msg: "Filepath is a directory",
            });
            return;
        }
    } catch (e) {}
    try {
        const res = await requestSource(mediaSource);
        const totalSize = Number(res.headers.get("content-length")) || 0;
        onStateChange({
            state,
            downloaded: 0,
            total: totalSize,
        });

        // 进度上报做节流，但完整性校验要用真实字节数，不能用节流后的计数
        const notify = throttle((downloaded: number, total: number) => {
            onStateChange({
                state: DownloadState.DOWNLOADING,
                downloaded,
                total,
            });
        }, 64, { leading: true, trailing: true });

        const result = await saveResponseToFile(res, filePath, {
            onProgress: ({ downloaded, total }) => notify(downloaded, total),
        });

        if (!result.ok) {
            state = DownloadState.ERROR;
            onStateChange({
                state,
                msg: result.error?.message,
            });
            return;
        }

        state = DownloadState.DONE;
        onStateChange({
            state,
        });
    } catch (e) {
        state = DownloadState.ERROR;
        onStateChange({
            state,
            msg: e?.message,
        });
        await removeFile(getTempFilePath(filePath));
    }
}


interface IOptions {
    onProgress?: (progress: ICommon.IDownloadFileSize) => Promise<void>;
    onEnded?: () => Promise<void>;
    onError?: (reason: Error) => Promise<void>;
}
async function downloadFileNew(
    mediaSource: IMusic.IMusicSource,
    filePath: string,
    options?: IOptions,
) {
    const { onProgress: onProgressCallback, onEnded: onEndedCallback, onError: onErrorCallback } = options ?? {};
    try {
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            onErrorCallback?.(new Error("Filepath is a directory"));
            return;
        }
    } catch (e) {
    // pass
    }

    try {
        const res = await requestSource(mediaSource);
        const totalSize = Number(res.headers.get("content-length")) || 0;
        onProgressCallback?.({
            currentSize: 0,
            totalSize: totalSize,
        });

        const result = await saveResponseToFile(res, filePath, {
            onProgress: ({ downloaded, total }) => {
                onProgressCallback?.({
                    currentSize: downloaded,
                    totalSize: total,
                });
            },
        });

        if (!result.ok) {
            onErrorCallback?.(result.error ?? new Error("下载失败"));
            return;
        }

        onEndedCallback?.();
    } catch (e) {
        onErrorCallback?.(e);
        await removeFile(getTempFilePath(filePath));
    }
}



Comlink.expose({
    downloadFile,
    downloadFileNew,
});
