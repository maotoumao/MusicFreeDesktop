import path from 'path';
import type { TagLib } from 'taglib-wasm';
import type { IAudioTagWriter } from '@appTypes/infra/audioTag';

/** 可写入标签的格式（.m4s 为 DASH 分段，不是完整文件） */
const WRITABLE_EXTS = new Set([
    '.mp3',
    '.flac',
    '.m4a',
    '.mp4',
    '.aac',
    '.ogg',
    '.opus',
    '.wav',
    '.wma',
    '.ape',
]);

/** 首次写入时才加载 wasm（约 60ms）；初始化失败后下次调用重试 */
let taglibPromise: Promise<TagLib> | null = null;

function getTagLib(): Promise<TagLib> {
    taglibPromise ??= import('taglib-wasm')
        .then(({ TagLib }) => TagLib.initialize())
        .catch((err) => {
            taglibPromise = null;
            throw err;
        });
    return taglibPromise;
}

/** 基于 taglib-wasm：Node 下按需读写文件头部，不把整个音频文件读入内存 */
const taglibWasmBackend: IAudioTagWriter = {
    canWrite(filePath) {
        return WRITABLE_EXTS.has(path.extname(filePath).toLowerCase());
    },

    async write(filePath, tags) {
        const taglib = await getTagLib();
        await taglib.edit(filePath, (file) => {
            const tag = file.tag();
            if (tags.title !== undefined) tag.setTitle(tags.title);
            if (tags.artist !== undefined) tag.setArtist(tags.artist);
            if (tags.album !== undefined) tag.setAlbum(tags.album);
            if (tags.cover) {
                file.setPictures([
                    { mimeType: tags.cover.mimeType, data: tags.cover.data, type: 'FrontCover' },
                ]);
            }
        });
    },
};

export default taglibWasmBackend;
