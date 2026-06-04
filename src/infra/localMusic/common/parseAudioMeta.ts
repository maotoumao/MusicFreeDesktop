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
 *
 * 策略：不用 jschardet 的编码名判断（短字符串易误判），而是直接尝试用各中文编码
 * 解码 latin1 字节序列，若结果含 CJK 字符（U+4E00~U+9FFF）则视为正确解码。
 */
async function fixCJKEncoding(common: ICommonTagsResult): Promise<void> {
    const fields: Array<{ value: string | undefined; set: (v: string) => void }> = [
        { value: common.title, set: (v) => { common.title = v; } },
        { value: common.artist, set: (v) => { common.artist = v; } },
        { value: common.album, set: (v) => { common.album = v; } },
    ];

    const hasAnyField = fields.some((f) => f.value);
    if (!hasAnyField) return;

    const iconv = await import('iconv-lite');

    /** 尝试将一个字段从 latin1 重新解码为中文编码，若含 CJK 字符则返回解码结果 */
    const tryFix = (value: string): string | null => {
        const buf = Buffer.from(value, 'latin1');
        for (const enc of SPECIAL_ENCODINGS) {
            const decoded = iconv.decode(buf, enc);
            // 检查是否包含 CJK 统一表意文字区段
            if (/[\u4e00-\u9fff]/.test(decoded)) {
                return decoded;
            }
        }
        return null;
    };

    for (const field of fields) {
        if (!field.value) continue;
        const fixed = tryFix(field.value);
        if (fixed !== null) {
            field.set(fixed);
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
