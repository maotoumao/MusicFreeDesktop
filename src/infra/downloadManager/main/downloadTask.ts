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

            // 3. 发起请求（读取临时文件期间被中止时不再发起）
            if (this.isAborted) return;
            this.abortController = new AbortController();
            const response = await axios.get(url, {
                headers,
                responseType: 'stream',
                signal: this.abortController.signal,
                timeout: 30_000,
            });

            // 4. 解析总大小
            const contentLength = parseInt(String(response.headers['content-length'] ?? '0'), 10);
            const isPartial = response.status === 206;

            if (isPartial) {
                this.task.totalBytes = existingBytes + contentLength;
                this.task.downloadedBytes = existingBytes;
            } else {
                // 服务器不支持 Range，从头下载；-1 表示总大小未知
                this.task.totalBytes = contentLength > 0 ? contentLength : -1;
                this.task.downloadedBytes = 0;
                existingBytes = 0;
            }
            // 先报告本次的起点：从头下载时界面不再沿用上一次的进度
            onProgress(this.task.downloadedBytes, this.task.totalBytes, 0);

            // 5. 创建写入流
            await fsp.mkdir(path.dirname(this.task.tempPath!), { recursive: true });
            // 创建目录期间被中止：不再创建临时文件
            if (this.isAborted) {
                response.data.destroy();
                return;
            }
            this.writeStream = fs.createWriteStream(this.task.tempPath!, {
                flags: isPartial ? 'a' : 'w',
            });

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
            await pipeline(dataStream, this.writeStream);

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
