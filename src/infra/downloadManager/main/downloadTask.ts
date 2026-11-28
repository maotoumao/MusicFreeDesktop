/**
 * downloadManager — 下载任务执行器
 *
 * 职责：
 * - 单个文件的 HTTP 流式下载（支持断点续传）
 * - 推断文件扩展名（按文件内容识别，其次 Content-Type）
 * - 下载速度计算
 */
import fs from 'fs';
import fsp from 'fs/promises';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';
import path from 'path';
import axios from 'axios';
import { safeParse } from '@common/safeSerialize';
import type { IDownloadTask } from '@appTypes/infra/downloadManager';

/** MIME → 文件扩展名映射 */
const MIME_TO_EXT: Record<string, string> = {
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    'audio/x-flac': '.flac',
    'audio/ogg': '.ogg',
    'application/ogg': '.ogg',
    'audio/opus': '.opus',
    'audio/webm': '.webm',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
};

/** 按文件内容识别音频格式对应的扩展名；无法识别时返回 null */
async function detectAudioExt(filePath: string): Promise<string | null> {
    try {
        const { parseFile } = await import('music-metadata');
        const { format } = await parseFile(filePath, { skipCovers: true, duration: false });
        const container = format.container ?? '';
        const codec = format.codec ?? '';
        if (container === 'FLAC') return '.flac';
        if (container === 'MPEG') return '.mp3';
        if (container === 'WAVE') return '.wav';
        if (container === 'Ogg') return codec === 'Opus' ? '.opus' : '.ogg';
        if (container.startsWith('ADTS')) return '.aac';
        if (container.startsWith('EBML')) return '.webm';
        // MP4 的 container 是 ftyp 品牌列表（如 M4A/isom/iso2），按编码判断
        if (codec.startsWith('MPEG-4/') || codec === 'ALAC') return '.m4a';
    } catch {
        /* 无法解析时交给 Content-Type 判断 */
    }
    return null;
}

export class DownloadTask {
    public task: IDownloadTask;
    public speed = 0;
    public isAborted = false;
    private abortController: AbortController | null = null;
    private writeStream: fs.WriteStream | null = null;
    private lastSpeedCheckTime = 0;
    private lastSpeedCheckBytes = 0;

    constructor(task: IDownloadTask) {
        this.task = task;
    }

    /**
     * 执行下载。
     * 支持断点续传：如果 tempPath 已存在，读取已有大小作为 Range 起点。
     */
    async execute(
        onProgress: (downloadedBytes: number, totalBytes: number, speed: number) => void,
        onCompleted: () => void | Promise<void>,
        onError: (err: Error) => void,
    ): Promise<void> {
        try {
            const mediaSource = safeParse<Record<string, any>>(this.task.mediaSource ?? '');
            if (!mediaSource) throw new Error('Invalid mediaSource');
            const url = mediaSource.url;
            if (!url) throw new Error('No download URL');

            // 1. 检查已有临时文件（断点续传）
            // 始终以临时文件的实际大小为准，忽略 DB 中的 downloadedBytes
            let existingBytes = 0;
            if (this.task.tempPath) {
                try {
                    const stat = await fsp.stat(this.task.tempPath);
                    existingBytes = stat.size;
                } catch {
                    existingBytes = 0;
                }
            }

            // 2. 构建请求 headers
            const headers: Record<string, string> = {
                ...(mediaSource.headers ?? {}),
            };
            if (mediaSource.userAgent) {
                headers['User-Agent'] = mediaSource.userAgent;
            }
            if (existingBytes > 0) {
                headers['Range'] = `bytes=${existingBytes}-`;
            }
            // 请求不压缩的原始数据（插件指定了就沿用）
            if (!Object.keys(headers).some((k) => k.toLowerCase() === 'accept-encoding')) {
                headers['Accept-Encoding'] = 'identity';
            }

            // 3. 发起请求（读取临时文件期间被中止时不再发起）
            if (this.isAborted) return;
            this.abortController = new AbortController();
            const response = await axios.get(url, {
                headers,
                responseType: 'stream',
                signal: this.abortController.signal,
                timeout: 30_000,
                // 自行解压：保留 Content-Encoding，接收字节数才能与 Content-Length 对照
                decompress: false,
            });

            // 4. 解析总大小（压缩响应的长度、进度都按接收到的压缩字节计）
            const encoding = String(response.headers['content-encoding'] ?? '')
                .trim()
                .toLowerCase();
            const decoder =
                encoding === 'gzip' || encoding === 'x-gzip' || encoding === 'deflate'
                    ? zlib.createUnzip()
                    : encoding === 'br'
                      ? zlib.createBrotliDecompress()
                      : encoding === 'zstd' && typeof zlib.createZstdDecompress === 'function'
                        ? zlib.createZstdDecompress()
                        : null;
            const contentLength = parseInt(String(response.headers['content-length'] ?? '0'), 10);
            const isPartial = response.status === 206;

            // 服务器不支持 Range 时从头下载；-1 表示总大小未知。
            // 起点在写入流打开（从头下载时清空临时文件）后才生效，此前中止时任务记录保持上一次的进度
            // 续传时完整大小优先取 Content-Range 里的总长（格式完整、从已有字节处开始、区间合法时才采用），
            // 其次是已有字节加本次长度，都没有时未知
            const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
                String(response.headers['content-range'] ?? '').trim(),
            );
            const [rangeStart, rangeEnd, rangeSize] = range ? range.slice(1).map(Number) : [];
            const rangeTotal =
                range &&
                rangeStart === existingBytes &&
                rangeEnd >= rangeStart &&
                rangeSize > rangeEnd &&
                Number.isSafeInteger(rangeSize)
                    ? rangeSize
                    : -1;
            // 续传响应不是从已有字节处接着发：追加会拼错文件，按失败处理（重试换用新的临时文件从头下载）
            if (isPartial && range && rangeStart !== existingBytes) {
                response.data.destroy();
                throw new Error(`Range mismatch: expected ${existingBytes}, got ${rangeStart}`);
            }
            const startBytes = isPartial ? existingBytes : 0;
            const totalBytes = isPartial
                ? rangeTotal > 0
                    ? rangeTotal
                    : contentLength > 0
                      ? existingBytes + contentLength
                      : -1
                : contentLength > 0
                  ? contentLength
                  : -1;

            // 5. 创建写入流
            await fsp.mkdir(path.dirname(this.task.tempPath!), { recursive: true });
            // 创建目录期间被中止：不再创建临时文件
            if (this.isAborted) {
                response.data.destroy();
                return;
            }
            const writeStream = fs.createWriteStream(this.task.tempPath!, {
                flags: isPartial ? 'a' : 'w',
            });
            this.writeStream = writeStream;
            // 等文件真正打开（从头下载时此刻才清空）再生效起点；打开失败按出错处理，任务记录保持上一次的进度
            try {
                await new Promise<void>((resolve, reject) => {
                    writeStream.once('open', () => resolve());
                    writeStream.once('error', reject);
                    writeStream.once('close', () => resolve());
                });
            } catch (err) {
                response.data.destroy();
                throw err;
            }
            if (this.isAborted) {
                response.data.destroy();
                return;
            }
            this.task.totalBytes = totalBytes;
            this.task.downloadedBytes = startBytes;
            // 先报告本次的起点：从头下载时界面不再沿用上一次的进度
            onProgress(startBytes, totalBytes, 0);

            // 6. 流式下载
            this.lastSpeedCheckTime = Date.now();
            this.lastSpeedCheckBytes = this.task.downloadedBytes;

            const dataStream = response.data;
            dataStream.on('data', (chunk: Buffer) => {
                this.task.downloadedBytes += chunk.length;

                const now = Date.now();
                const elapsed = (now - this.lastSpeedCheckTime) / 1000;
                if (elapsed >= 1) {
                    this.speed = (this.task.downloadedBytes - this.lastSpeedCheckBytes) / elapsed;
                    this.lastSpeedCheckTime = now;
                    this.lastSpeedCheckBytes = this.task.downloadedBytes;
                }

                onProgress(this.task.downloadedBytes, this.task.totalBytes, this.speed);
            });

            // 写入流在写完前被中止（abort 会 destroy 它）时以错误结束，不会一直等下去
            if (decoder) {
                await pipeline(dataStream, decoder, this.writeStream);
            } else {
                await pipeline(dataStream, this.writeStream);
            }

            // 已知总大小时核对是否收全：只收到部分内容不能登记为完成。
            // 压缩响应核对接收到的字节数，未压缩的核对文件大小
            if (totalBytes > 0) {
                const size = decoder
                    ? this.task.downloadedBytes
                    : (await fsp.stat(this.task.tempPath!)).size;
                if (size !== totalBytes) {
                    throw new Error(`Incomplete download: ${size} of ${totalBytes} bytes`);
                }
            }

            // 7. 推断文件扩展名：Content-Type 不可靠，优先按文件内容识别，兜底 .mp3
            const mime = String(response.headers['content-type'] ?? '')
                .split(';')[0]
                .trim()
                .toLowerCase();
            const ext = (await detectAudioExt(this.task.tempPath!)) ?? MIME_TO_EXT[mime] ?? '.mp3';
            const finalPath = await this.claimFinalPath(ext);

            // 8. 下载完成 → rename 临时文件（覆盖本任务占位的空文件）
            try {
                await fsp.rename(this.task.tempPath!, finalPath);
            } catch (err) {
                await fsp.unlink(finalPath).catch(() => {});
                throw err;
            }
            this.task.filePath = finalPath;

            await onCompleted();
        } catch (err: any) {
            if (axios.isCancel(err)) return;
            onError(err);
        } finally {
            // 确保 writeStream 被清理
            if (this.writeStream) {
                this.writeStream.destroy();
                this.writeStream = null;
            }
        }
    }

    /** 中止下载（暂停或取消时调用） */
    abort(): void {
        this.isAborted = true;
        this.abortController?.abort();
        this.abortController = null;
        this.writeStream?.destroy();
        this.writeStream = null;
    }

    /**
     * filePath 不含扩展名（由 buildFileName 生成），此处追加扩展名，并以独占方式创建空文件占住该路径。
     * 目标已存在（含其他任务刚占住的同名路径）时追加数字后缀，同名下载并行完成也不会互相覆盖。
     */
    private async claimFinalPath(ext: string): Promise<string> {
        const base = this.task.filePath!;
        for (let suffix = 0; ; suffix++) {
            const candidate = suffix === 0 ? base + ext : `${base} (${suffix})${ext}`;
            try {
                await (await fsp.open(candidate, 'wx')).close();
                return candidate;
            } catch (err: any) {
                if (err?.code !== 'EEXIST') throw err; // 权限不足等 I/O 错误向上抛出
            }
        }
    }
}
