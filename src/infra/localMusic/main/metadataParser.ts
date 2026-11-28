/**
 * localMusic — 元数据解析器
 *
 * 职责：
 * - 解析单个文件的 ID3/Vorbis 标签（音频元数据）
 * - 通过 mediaMeta.download_path 反查确定身份
 * - 兜底使用文件名作为标题
 */

import { createHash } from 'crypto';
import path from 'path';
import { LOCAL_PLUGIN_NAME } from '@common/constant';
import { parseAudioMeta } from '@infra/localMusic/common/parseAudioMeta';
import type { IAudioFormat, ILocalMusicItem } from '@appTypes/infra/localMusic';
import type { IMediaMetaProvider } from '@appTypes/infra/mediaMeta';

/**
 * 解析单个文件的元数据。
 *
 * 1. 先查 mediaMeta.download_path 反查：如果命中，复用原始 platform+id
 * 2. 否则用 parseAudioMeta 解析 ID3/Vorbis 标签（含 CJK 编码修正）
 * 3. 兜底用文件名作为标题
 */
export async function parseFileMetadata(
    filePath: string,
    fileSize: number,
    fileMtime: number,
    scanFolderId: string,
    mediaMeta: IMediaMetaProvider,
): Promise<ILocalMusicItem> {
    const parsed = path.parse(filePath);
    const folder = parsed.dir;

    // ─── 1. download_path 反查 ───
    const linked = mediaMeta.getMetaByDownloadPath(filePath);

    let platform: string;
    let musicId: string;

    if (linked) {
        platform = linked.platform;
        musicId = linked.musicId;
    } else {
        platform = LOCAL_PLUGIN_NAME;
        musicId = createHash('md5').update(filePath).digest('hex');
    }

    // ─── 2. 解析文件元数据 ───
    const meta = await parseAudioMeta(filePath, { skipCovers: true, skipLyrics: true });

    return {
        filePath,
        platform,
        id: musicId,
        title: meta.title ?? parsed.name,
        artist: meta.artist ?? '',
        album: meta.album ?? '',
        duration: meta.duration ?? null,
        artwork: null,
        folder,
        fileSize,
        fileMtime: Math.floor(fileMtime),
        scanFolderId,
        createdAt: Date.now(),
        ...toAudioColumns(meta.audio),
    };
}

/** 编码参数 → local_music 的编码列；未识别出编码时 codec 存空字符串，避免每次扫描重复补录 */
export function toAudioColumns(
    audio: IAudioFormat | undefined,
): Pick<
    ILocalMusicItem,
    'codec' | 'lossless' | 'bitrate' | 'sampleRate' | 'bitsPerSample' | 'channels'
> {
    return {
        codec: audio?.codec ?? '',
        lossless: audio?.lossless === undefined ? null : Number(audio.lossless),
        bitrate: audio?.bitrate ?? null,
        sampleRate: audio?.sampleRate ?? null,
        bitsPerSample: audio?.bitsPerSample ?? null,
        channels: audio?.channels ?? null,
    };
}
