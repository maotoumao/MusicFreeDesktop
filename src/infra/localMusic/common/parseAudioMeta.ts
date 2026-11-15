/**
 * 共享的音频文件元数据解析函数。
 *
 * 统一 music-metadata 调用 + CJK 编码修正逻辑，
 * 供 localPlugin（导入）和 metadataParser（扫描）共同使用。
 */

import type { ICommonTagsResult, IPicture } from 'music-metadata';
import fsp from 'fs/promises';
import path from 'path';
import type { IAudioFormat, MetadataValue } from '@appTypes/infra/localMusic';

/** 需要特殊处理的编码 */
const SPECIAL_ENCODINGS = new Set(['GB2312', 'GB18030', 'GBK', 'Big5']);

export interface ParseAudioMetaOptions {
    /** 跳过封面提取（扫描场景可设为 true 以提升性能） */
    skipCovers?: boolean;
    /** 跳过歌词提取 */
    skipLyrics?: boolean;
    /** 仅扫描/导入等需要补算时长的场景开启。 */
    duration?: boolean;
    includeDetails?: boolean;
    /** 调用方刚读取的 stat，可避免扫描时再次 stat。 */
    fileInfo?: { size: number; mtime: number };
}

export interface ParsedAudioMeta {
    filePath: string;
    fileSize: number;
    fileMtime: number;
    format: IAudioFormat;
    common: Record<string, MetadataValue>;
    native: Record<string, MetadataValue>;
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    /** base64 data URI，仅在 skipCovers 为 false 时可能有值 */
    artwork?: string;
    /** 原始歌词文本，仅在 skipLyrics 为 false 时可能有值 */
    rawLrc?: string;
}

interface CacheEntry {
    filePath: string;
    size: number;
    mtime: number;
    capabilities: number;
    result: ParsedAudioMeta;
    bytes: number;
}

const CACHE_ENTRIES = 64;
const CACHE_BYTES = 16 * 1024 * 1024;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<
    string,
    {
        filePath: string;
        size: number;
        mtime: number;
        capabilities: number;
        promise: Promise<ParsedAudioMeta>;
    }
>();
let cacheBytes = 0;

export function invalidateAudioMeta(filePath: string): void {
    const normalized = path.resolve(filePath);
    for (const [key, entry] of cache) {
        if (entry.filePath === normalized) {
            cache.delete(key);
            cacheBytes -= entry.bytes;
        }
    }
    for (const [key, entry] of inflight) {
        if (entry.filePath === normalized) inflight.delete(key);
    }
}

/** 在 music-metadata 边界转换一次，避免 IPC 携带 Buffer 或原生标签图片。 */
function serializableTags(value: unknown): MetadataValue {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'bigint') return value.toString();
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
        return { type: 'binary', byteLength: value.byteLength };
    }
    if (Array.isArray(value)) return value.map(serializableTags);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, serializableTags(item)]),
        );
    }
    return String(value);
}

function getB64Picture(picture: IPicture): string {
    return `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`;
}

/**
 * 检测并修正 CJK 元数据中的编码问题。
 * 部分音频文件的标签使用 GB2312 等编码写入，但 music-metadata 按 latin1 解析，
 * 导致标题/艺术家/专辑字段乱码，需要检测后重新解码。
 */
async function fixCJKEncoding(common: ICommonTagsResult): Promise<void> {
    const testFields = [common.title, common.artist, common.album];
    if (testFields.every((f) => !f)) return;

    const jschardet = await import('jschardet');
    let bestEncoding: string | null = null;
    let bestConfidence = 0;

    for (const field of testFields) {
        if (!field) continue;
        const result = jschardet.detect(field, { minimumThreshold: 0.4 });
        if (result.confidence > bestConfidence) {
            bestConfidence = result.confidence;
            bestEncoding = result.encoding;
        }
        if (bestConfidence > 0.9) break;
    }

    if (!bestEncoding || !SPECIAL_ENCODINGS.has(bestEncoding)) return;

    const iconv = await import('iconv-lite');
    const decode = (value: string) => iconv.decode(Buffer.from(value, 'latin1'), bestEncoding!);

    if (common.title) common.title = decode(common.title);
    if (common.artist) common.artist = decode(common.artist);
    if (common.album) common.album = decode(common.album);
    if (common.lyrics) {
        for (const lyric of common.lyrics) {
            if (lyric.text) lyric.text = decode(lyric.text);
        }
    }
}

/**
 * 解析音频文件的元数据（标题、艺术家、专辑、时长、封面、歌词）。
 *
 * 按路径、size、mtime 和读取能力共享有界缓存；失败向调用方传播，不缓存失败。
 */
export async function parseAudioMeta(
    filePath: string,
    options?: ParseAudioMetaOptions,
): Promise<ParsedAudioMeta> {
    const {
        skipCovers = false,
        skipLyrics = false,
        duration = false,
        includeDetails = false,
        fileInfo,
    } = options ?? {};
    const normalized = path.resolve(filePath);
    const stat =
        fileInfo ?? (await fsp.stat(normalized).then((s) => ({ size: s.size, mtime: s.mtimeMs })));
    const capabilities =
        (skipCovers ? 0 : 1) | (skipLyrics ? 0 : 2) | (duration ? 4 : 0) | (includeDetails ? 8 : 0);
    const key = JSON.stringify([normalized, stat.size, stat.mtime, capabilities]);

    for (const [cachedKey, entry] of cache) {
        if (
            entry.filePath === normalized &&
            entry.size === stat.size &&
            entry.mtime === stat.mtime &&
            (entry.capabilities & capabilities) === capabilities
        ) {
            cache.delete(cachedKey);
            cache.set(cachedKey, entry);
            return entry.result;
        }
    }
    for (const pending of inflight.values()) {
        if (
            pending.filePath === normalized &&
            pending.size === stat.size &&
            pending.mtime === stat.mtime &&
            (pending.capabilities & capabilities) === capabilities
        )
            return pending.promise;
    }

    const promise: Promise<ParsedAudioMeta> = (async (): Promise<ParsedAudioMeta> => {
        const { parseFile } = await import('music-metadata');
        const metadata = await parseFile(normalized, {
            duration,
            skipCovers,
        });
        const common = metadata.common;

        await fixCJKEncoding(common);

        const { codec, container, lossless, bitrate, sampleRate, bitsPerSample, numberOfChannels } =
            metadata.format;
        const result: ParsedAudioMeta = {
            filePath: normalized,
            fileSize: stat.size,
            fileMtime: stat.mtime,
            format: {
                codec,
                container,
                lossless,
                bitrate,
                sampleRate,
                bitsPerSample,
                numberOfChannels,
                duration: metadata.format.duration,
            },
            common: includeDetails
                ? (serializableTags(common) as Record<string, MetadataValue>)
                : {},
            native: includeDetails
                ? (serializableTags(metadata.native) as Record<string, MetadataValue>)
                : {},
        };

        if (common.title) result.title = common.title;
        if (common.artist) result.artist = common.artist;
        if (common.album) result.album = common.album;
        if (metadata.format.duration !== undefined) result.duration = metadata.format.duration;

        if (!skipCovers && common.picture?.[0]) {
            result.artwork = getB64Picture(common.picture[0]);
        }

        if (!skipLyrics && common.lyrics?.length) {
            const lrc = common.lyrics.map((l) => l.text ?? '').join('');
            if (lrc) result.rawLrc = lrc;
        }

        // 只保留转换后的轻量标签；原始 Buffer 不进入缓存。
        const bytes = Buffer.byteLength(JSON.stringify(result));
        if (bytes <= CACHE_BYTES && inflight.get(key)?.promise === promise) {
            while (cache.size >= CACHE_ENTRIES || cacheBytes + bytes > CACHE_BYTES) {
                const oldest = cache.entries().next().value!;
                cache.delete(oldest[0]);
                cacheBytes -= oldest[1].bytes;
            }
            cache.set(key, {
                filePath: normalized,
                size: stat.size,
                mtime: stat.mtime,
                capabilities,
                result,
                bytes,
            });
            cacheBytes += bytes;
        }
        return result;
    })();
    inflight.set(key, {
        filePath: normalized,
        size: stat.size,
        mtime: stat.mtime,
        capabilities,
        promise,
    });
    try {
        return await promise;
    } finally {
        if (inflight.get(key)?.promise === promise) inflight.delete(key);
    }
}
