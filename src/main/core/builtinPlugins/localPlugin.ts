import { LOCAL_PLUGIN_NAME, SUPPORTED_AUDIO_EXTS } from '@common/constant';
import { createHash } from 'crypto';
import fsp from 'fs/promises';
import path from 'path';
import url from 'url';
import i18n from '@infra/i18n/main';
import { parseAudioMeta } from '@infra/localMusic/common/parseAudioMeta';

function addFileScheme(filePath: string): string {
    return filePath.startsWith('file:') ? filePath : url.pathToFileURL(filePath).toString();
}

/**
 * 解析单个本地音乐文件的元数据
 */
async function parseLocalMusicItem(filePath: string): Promise<IMusic.IMusicItem> {
    const id = createHash('md5').update(filePath).digest('hex');
    const meta = await parseAudioMeta(filePath);

    return {
        id,
        platform: LOCAL_PLUGIN_NAME,
        title: meta.title ?? (path.parse(filePath).name || filePath),
        artist: meta.artist ?? i18n.t('media.unknown_artist'),
        album: meta.album ?? i18n.t('media.unknown_album'),
        duration: meta.duration ?? null,
        url: addFileScheme(filePath),
        localPath: filePath,
        artwork: meta.artwork,
        rawLrc: meta.rawLrc,
    };
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
            SUPPORTED_AUDIO_EXTS.has(path.extname(f).toLowerCase()),
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
        if (musicItem.rawLrc) {
            return {
                rawLrc: musicItem.rawLrc,
            };
        } else {
            const meta = await parseAudioMeta(musicItem.localPath!, {
                skipCovers: true,
                skipLyrics: false,
            });
            if (meta.rawLrc) {
                return {
                    rawLrc: meta.rawLrc,
                };
            }
        }
    },
    async importMusicItem(filePath) {
        return parseLocalMusicItem(filePath);
    },
    async importMusicSheet(folderPath) {
        return parseLocalMusicItemFolder(folderPath);
    },
    async getMusicInfo(musicItem) {
        if (!musicItem.artwork) {
            const meta = await parseAudioMeta(musicItem.localPath!, {
                skipCovers: false,
                skipLyrics: true,
            });
            if (meta.artwork) {
                return {
                    artwork: meta.artwork,
                };
            }
        }
        return null;
    },
};

export default localPluginDefine;
