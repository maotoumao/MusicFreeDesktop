import { LOCAL_PLUGIN_NAME } from '@common/constant';
import { createHash } from 'crypto';
import fsp from 'fs/promises';
import path from 'path';
import url from 'url';
import i18n from '@infra/i18n/main';
import type { ICommonTagsResult, IPicture } from 'music-metadata';

/** 支持的本地音频文件扩展名 */
const SUPPORTED_EXTENSIONS = new Set([
    '.mp3',
    '.mp4',
    '.m4s',
    '.flac',
    '.wma',
    '.wav',
    '.m4a',
    '.ogg',
    '.aac',
    '.opus',
]);

/** 需要特殊处理的编码 */
const SPECIAL_ENCODINGS = new Set(['GB2312', 'GB18030', 'GBK', 'Big5']);

function addFileScheme(filePath: string): string {
    return filePath.startsWith('file:') ? filePath : url.pathToFileURL(filePath).toString();
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
    // music-metadata 将非 UTF-8 标签按 latin1 解析为 string，
    // 此处需要将其当作原始字节流重新解码为正确编码
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
 * 解析单个本地音乐文件的元数据
 */
async function parseLocalMusicItem(filePath: string): Promise<IMusic.IMusicItem> {
    const id = createHash('md5').update(filePath).digest('hex');
    const fallback: IMusic.IMusicItem = {
        id,
        platform: LOCAL_PLUGIN_NAME,
        title: path.parse(filePath).name || filePath,
        artist: i18n.t('media.unknown_artist'),
        album: i18n.t('media.unknown_album'),
        url: addFileScheme(filePath),
        localPath: filePath,
    };

    try {
        const { parseFile } = await import('music-metadata');
        const { common } = await parseFile(filePath);
        await fixCJKEncoding(common);

        return {
            ...fallback,
            title: common.title ?? fallback.title,
            artist: common.artist ?? fallback.artist,
            album: common.album ?? fallback.album,
            artwork: common.picture?.[0] ? getB64Picture(common.picture[0]) : undefined,
            rawLrc: common.lyrics?.map((l) => l.text ?? '').join('') || undefined,
        };
    } catch (error) {
        console.log('Failed to parse music metadata for', filePath, error);
        return fallback;
    }
}

/**
 * 解析文件夹中所有支持格式的本地音乐文件（并发限制为 8）
 */
async function parseLocalMusicItemFolder(folderPath: string): Promise<IMusic.IMusicItem[]> {
    try {
        const stat = await fsp.stat(folderPath);
        if (!stat.isDirectory()) return [];

        const files = await fsp.readdir(folderPath);
        const musicFiles = files.filter((f) =>
            SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()),
        );

        const { default: PQueue } = await import('p-queue');
        const queue = new PQueue({ concurrency: 10 });
        return queue.addAll(
            musicFiles.map((f) => () => parseLocalMusicItem(path.resolve(folderPath, f))),
        );
    } catch {
        return [];
    }
}

const localPluginDefine: IPlugin.IPluginInstance = {
    platform: LOCAL_PLUGIN_NAME,
    _path: '', // 内建插件不从磁盘加载，无需路径
    async getMediaSource(musicItem) {
        return {
            url: addFileScheme(musicItem.url),
        };
    },
    async getLyric(musicItem) {
        return {
            rawLrc: musicItem.rawLrc,
        };
    },
    async importMusicItem(filePath) {
        return parseLocalMusicItem(filePath);
    },
    async importMusicSheet(folderPath) {
        return parseLocalMusicItemFolder(folderPath);
    },
};

export default localPluginDefine;
