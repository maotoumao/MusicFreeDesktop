/**
 * 共享的音频文件元数据解析函数。
 *
 * 统一 music-metadata 调用 + CJK 编码修正逻辑，
 * 供 localPlugin（导入）和 metadataParser（扫描）共同使用。
 */

import type { ICommonTagsResult, IPicture } from 'music-metadata';

/** 需要特殊处理的编码 */
const SPECIAL_ENCODINGS = new Set(['GB2312', 'GB18030', 'GBK', 'Big5']);

export interface ParseAudioMetaOptions {
    /** 跳过封面提取（扫描场景可设为 true 以提升性能） */
    skipCovers?: boolean;
    /** 跳过歌词提取 */
    skipLyrics?: boolean;
}

export interface ParsedAudioMeta {
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    /** base64 data URI，仅在 skipCovers 为 false 时可能有值 */
    artwork?: string;
    /** 原始歌词文本，仅在 skipLyrics 为 false 时可能有值 */
    rawLrc?: string;
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
 * 内部统一处理 CJK 编码修正。解析失败时返回空对象（由调用方决定 fallback）。
 */
export async function parseAudioMeta(
    filePath: string,
    options?: ParseAudioMetaOptions,
): Promise<ParsedAudioMeta> {
    const { skipCovers = false, skipLyrics = false } = options ?? {};

    try {
        const { parseFile } = await import('music-metadata');
        const metadata = await parseFile(filePath, {
            duration: true,
            skipCovers,
        });
        const common = metadata?.common;
        if (!common) return {};

        await fixCJKEncoding(common);

        const result: ParsedAudioMeta = {};

        if (common.title) result.title = common.title;
        if (common.artist) result.artist = common.artist;
        if (common.album) result.album = common.album;
        if (metadata.format?.duration) result.duration = metadata.format.duration;

        if (!skipCovers && common.picture?.[0]) {
            result.artwork = getB64Picture(common.picture[0]);
        }

        if (!skipLyrics && common.lyrics?.length) {
            const lrc = common.lyrics.map((l) => l.text ?? '').join('');
            if (lrc) result.rawLrc = lrc;
        }

        return result;
    } catch {
        return {};
    }
}
