/**
 * metadataWriter — 写入音频文件标签
 *
 * 支持将歌曲元数据（标题、歌手、专辑）写入音频文件的嵌入式标签。
 * 当前仅支持 MP3（ID3v2），后续可扩展其他格式。
 */

import NodeID3 from 'node-id3';
import path from 'path';

/** 支持嵌入式标签写入的文件扩展名 */
const TAGGABLE_EXTS = new Set(['.mp3']);

/** 明确不支持嵌入式标签的格式说明 */
const UNSUPPORTED_TAG_FORMATS: Record<string, string> = {
    '.m4s': 'M4S 分段文件不支持嵌入式标签',
    '.wav': 'WAV 格式不支持嵌入式标签',
};

/**
 * 检测文件是否支持写入嵌入式标签。
 * 返回 null 表示支持，返回字符串表示不支持的原因。
 */
export function canWriteTags(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();

    if (TAGGABLE_EXTS.has(ext)) return null;

    // 明确不支持的原因
    const reason = UNSUPPORTED_TAG_FORMATS[ext];
    if (reason) return reason;

    // 其他格式（flac, ogg, m4a 等）暂未实现写入
    return `暂不支持写入 ${ext} 格式的标签，仅更新数据库记录`;
}

// ─── 写入参数 ───

export interface IMetadataToWrite {
    title: string;
    artist: string;
    album: string;
}

/**
 * 将元数据写入音频文件标签。
 *
 * @param filePath 音频文件绝对路径
 * @param meta 要写入的元数据
 * @throws 写入失败时抛出异常
 */
export async function writeFileTags(filePath: string, meta: IMetadataToWrite): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();

    if (!TAGGABLE_EXTS.has(ext)) {
        // 不支持写入的文件类型静默跳过（由调用方检查 canWriteTags）
        return;
    }

    const tags: NodeID3.Tags = {
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
    };

    return new Promise((resolve, reject) => {
        NodeID3.write(tags, filePath, (err) => {
            if (err) reject(new Error(`写入文件标签失败: ${err.message}`));
            else resolve();
        });
    });
}
