/**
 * 下载落盘的核心逻辑。
 *
 * 单独拆出来是为了能脱离 Electron/Comlink 直接跑测试 ——
 * 「服务器提前断开」这种故障只有在真实流上才能复现。
 */

import fs from "fs";
import fsPromises from "fs/promises";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export interface IDownloadProgress {
    downloaded: number;
    total: number;
}

export interface IDownloadResult {
    ok: boolean;
    downloaded: number;
    total: number;
    error?: Error;
}

/** 下载中的临时文件名：只有确认完整之后才改成正式文件名 */
export function getTempFilePath(filePath: string) {
    return `${filePath}.part`;
}

/**
 * 判断下载是否完整。
 *
 * 服务器提前断开时，响应体会「正常结束」（EOF），但收到的字节数比 content-length 少。
 * 这种文件如果当成下载成功留下来，之后播放会播到断点就没声音了 ——
 * 所以必须当成失败，删掉重来。
 */
export function isDownloadComplete(
    downloaded: number,
    total: number | null | undefined,
): boolean {
    // 服务端没给 content-length 时无从校验，只能认为完整
    if (!total || total <= 0) {
        return true;
    }
    return downloaded === total;
}

export async function removeFile(filePath: string) {
    try {
        if ((await fsPromises.stat(filePath)).isFile()) {
            await fsPromises.rm(filePath, { force: true });
        }
        return true;
    } catch {
        return false;
    }
}

/** 多久没有新数据就判定连接已经死了（毫秒） */
export const DEFAULT_IDLE_TIMEOUT = 30000;

export function responseToReadable(
    response: Response,
    options?: {
        onRead?: (size: number) => void;
        onDone?: () => void;
        onError?: (e: Error) => void;
        /** 空闲超时，默认 30 秒 */
        idleTimeout?: number;
    },
) {
    const reader = response.body!.getReader();
    const rs = new Readable();
    let size = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const idleTimeout = options?.idleTimeout ?? DEFAULT_IDLE_TIMEOUT;

    const clearIdle = () => {
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
    };
    const armIdle = () => {
        clearIdle();
        if (!idleTimeout || idleTimeout <= 0) {
            return;
        }
        idleTimer = setTimeout(() => {
            // 长时间没有新数据：连接多半已经断了。
            // 主动结束读取，让上层按「字节数不足」判失败，
            // 否则这个下载会一直挂着，半截文件也留在磁盘上。
            reader.cancel(new Error("下载超时")).catch(() => {});
        }, idleTimeout);
    };

    rs._read = async () => {
        armIdle();
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
            result = await reader.read();
        } catch (e) {
            // 网络中断：必须把错误抛到流上。
            // 否则流既不结束也不报错，下载任务会永远挂着，半截文件也会留在磁盘上。
            clearIdle();
            rs.destroy(e as Error);
            return;
        }
        clearIdle();
        if (!result.done) {
            rs.push(Buffer.from(result.value));
            size += result.value.byteLength;
            options?.onRead?.(size);
        } else {
            rs.push(null);
            options?.onDone?.();
        }
    };
    rs.on("close", clearIdle);
    if (options?.onError) {
        rs.on("error", options.onError);
    }
    return rs;
}

/**
 * 把响应体落到磁盘上。
 *
 * 先写 .part 临时文件，确认落盘的字节数和服务端给的 content-length 一致之后，
 * 才改成正式文件名。这样磁盘上不会留下「看着正常、其实缺了一截」的音频文件。
 */
export async function saveResponseToFile(
    response: Response,
    filePath: string,
    options?: {
        onProgress?: (progress: IDownloadProgress) => void;
        onError?: (e: Error) => void;
        /** 空闲超时，默认 30 秒 */
        idleTimeout?: number;
    },
): Promise<IDownloadResult> {
    const total = Number(response.headers.get("content-length")) || 0;
    const tempPath = getTempFilePath(filePath);
    let downloaded = 0;
    let streamError: Error | null = null;

    const rs = responseToReadable(response, {
        idleTimeout: options?.idleTimeout,
        onRead(size) {
            downloaded = size;
            options?.onProgress?.({ downloaded: size, total });
        },
        onError(e) {
            // 流上的错误先记下来，pipeline 会把同一个错误再抛一次
            streamError = e;
        },
    });

    try {
        // 用 pipeline 而不是手动 pipe：源流出错时 pipeline 会连目标流一起销毁。
        // 手动 pipe 的话源流的 error 不会传给目标流，写文件那一步会永远挂着，
        // 下载任务既不报错也不结束。
        await pipeline(rs, fs.createWriteStream(tempPath));
    } catch (e) {
        streamError = e as Error;
        options?.onError?.(streamError);
    }

    // 以磁盘上实际写了多少字节为准，不依赖回调里的计数
    let written = 0;
    try {
        written = fs.statSync(tempPath).size;
    } catch {
        written = 0;
    }

    if (streamError) {
        await removeFile(tempPath);
        return {
            ok: false,
            downloaded: written,
            total,
            error: streamError,
        };
    }

    if (!isDownloadComplete(written, total)) {
        await removeFile(tempPath);
        return {
            ok: false,
            downloaded: written,
            total,
            error: new Error(
                `下载不完整（${written}/${total} 字节），已丢弃，请重试`,
            ),
        };
    }

    try {
        // Windows 上 rename 不能覆盖已存在的文件
        if (fs.existsSync(filePath)) {
            await removeFile(filePath);
        }
        fs.renameSync(tempPath, filePath);
    } catch (e) {
        await removeFile(tempPath);
        return {
            ok: false,
            downloaded: written,
            total,
            error: e as Error,
        };
    }

    return { ok: true, downloaded: written, total };
}
