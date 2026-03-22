/**
 * downloadManager — 下载任务执行器
 *
 * 职责：
 * - 单个文件的 HTTP 流式下载（支持断点续传）
 * - 从 Content-Type 推断文件扩展名
 * - 下载速度计算
 */
import fs from 'fs';
import fsp from 'fs/promises';
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
        onCompleted: () => void,
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

            // 3. 发起请求
            this.abortController = new AbortController();
            const response = await axios.get(url, {
                headers,
                responseType: 'stream',
                signal: this.abortController.signal,
                timeout: 30_000,
            });

            // 4. 解析总大小
            const contentLength = parseInt(response.headers['content-length'] ?? '0', 10);
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

            // 5. 创建写入流
            await fsp.mkdir(path.dirname(this.task.tempPath!), { recursive: true });
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

            dataStream.pipe(this.writeStream);

            await new Promise<void>((resolve, reject) => {
                this.writeStream!.on('finish', resolve);
                this.writeStream!.on('error', reject);
                dataStream.on('error', reject);
            });

            // 7. 推断文件扩展名（从 Content-Type，兜底 .mp3）
            const contentType = response.headers['content-type'] ?? '';
            const finalPath = await this.resolveFinalPath(contentType);

            // 8. 下载完成 → rename 临时文件
            await fsp.rename(this.task.tempPath!, finalPath);
            this.task.filePath = finalPath;

            onCompleted();
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
     * 从 Content-Type 推断文件扩展名，兜底 .mp3。
     * filePath 不含扩展名（由 buildFileName 生成），此处追加推断的扩展名。
     * 若目标路径已存在文件，自动追加数字后缀避免覆盖。
     */
    private async resolveFinalPath(contentType: string): Promise<string> {
        const mime = contentType.split(';')[0].trim().toLowerCase();
        const ext = MIME_TO_EXT[mime] ?? '.mp3';
        const base = this.task.filePath!;
        let candidate = base + ext;

        // 避免覆盖已有文件
        let suffix = 1;
        while (true) {
            try {
                await fsp.access(candidate);
                // 文件存在，尝试下一个后缀
                candidate = `${base} (${suffix})${ext}`;
                suffix++;
            } catch (err: any) {
                if (err?.code === 'ENOENT') break;
                throw err; // 权限不足等 I/O 错误向上抛出
            }
        }

        return candidate;
    }
}
