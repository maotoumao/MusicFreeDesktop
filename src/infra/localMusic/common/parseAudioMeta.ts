/**
 * 共享的音频文件元数据解析函数。
 *
 * 统一 music-metadata 调用 + CJK 编码修正逻辑，
 * 供 localPlugin（导入）和 metadataParser（扫描）共同使用。
 */

import type { ICommonTagsResult, ILyricsTag, IPicture } from 'music-metadata';

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

/** GB2312 解码后允许出现的非 ASCII 字符：汉字与中文标点 */
const GB2312_NON_ASCII_REG = /^[\u00b7\u2010-\u2027\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]*$/;

/**
 * 按字节结构判断 latin1 字符串（即原始字节）是否为 GB2312 编码的中文：
 * 高位字节必须两两成对且落在 GB2312 区段内。latin1 文本中的重音字母多为单个高位字节，不满足该结构。
 */
function hasGb2312Structure(value: string): boolean {
    let hasHighByte = false;
    for (let i = 0; i < value.length; i++) {
        const lead = value.charCodeAt(i);
        if (lead < 0x80) continue;
        const trail = value.charCodeAt(i + 1);
        if (lead < 0xa1 || lead > 0xf7 || trail < 0xa1 || trail > 0xfe) return false;
        hasHighByte = true;
        i++;
    }
    return hasHighByte;
}

/**
 * 检测并修正 CJK 元数据中的编码问题。
 * 部分音频文件的标签使用 GB2312 等编码写入，但 music-metadata 按 latin1 解析，
 * 导致标题/艺术家/专辑字段乱码，需要检测后重新解码。
 * 单个字段太短时 jschardet 容易误判（如三个字的歌手名），因此合并检测；
 * 仍未识别时按 GB2312 的字节结构判断，且解码结果必须全是汉字或中文标点。
 */
async function fixCJKEncoding(common: ICommonTagsResult): Promise<void> {
    const fields = [common.title, common.artist, common.album].filter((f): f is string => !!f);
    if (fields.length === 0) return;

    const jschardet = await import('jschardet');
    const iconv = await import('iconv-lite');
    const toBytes = (value: string) => Buffer.from(value, 'latin1');

    let bestEncoding: string | null = jschardet.detect(fields.join(' '), {
        minimumThreshold: 0.4,
    }).encoding;

    if (!bestEncoding || !SPECIAL_ENCODINGS.has(bestEncoding)) {
        const highByteFields = fields.filter((f) => /[\x80-\xff]/.test(f));
        const isGb2312 =
            highByteFields.length > 0 &&
            highByteFields.every(
                (f) =>
                    hasGb2312Structure(f) &&
                    GB2312_NON_ASCII_REG.test(
                        iconv.decode(toBytes(f), 'GB2312').replace(/[\x20-\x7e]/g, ''),
                    ),
            );
        if (!isGb2312) return;
        bestEncoding = 'GB2312';
    }

    const encoding = bestEncoding;
    const decode = (value: string) => iconv.decode(toBytes(value), encoding);

    if (common.title) common.title = decode(common.title);
    if (common.artist) common.artist = decode(common.artist);
    if (common.album) common.album = decode(common.album);
    if (common.lyrics) {
        for (const lyric of common.lyrics) {
            if (lyric.text) lyric.text = decode(lyric.text);
            for (const line of lyric.syncText ?? []) {
                line.text = decode(line.text);
            }
        }
    }
}

/** 毫秒 → [mm:ss.xxx] */
function formatLrcTime(ms: number): string {
    const min = String(Math.floor(ms / 60000)).padStart(2, '0');
    const sec = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
    return `[${min}:${sec}]`;
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
        const { parseFile, TimestampFormat } = await import('music-metadata');
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
            // music-metadata 会把 LRC 格式的歌词标签解析为 syncText，并去掉 text 中的时间戳
            const toLrc = (lyric: ILyricsTag) =>
                lyric.timeStampFormat === TimestampFormat.milliseconds &&
                lyric.syncText?.length &&
                lyric.syncText.every((line) => line.timestamp !== undefined)
                    ? lyric.syncText
                          .map((line) => `${formatLrcTime(line.timestamp!)}${line.text}`)
                          .join('\n')
                    : (lyric.text ?? '');
            const lrc = common.lyrics.map(toLrc).join('');
            if (lrc) result.rawLrc = lrc;
        }

        return result;
    } catch {
        return {};
    }
}
