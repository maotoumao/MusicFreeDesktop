import axios from 'axios';
import type { IAudioTags } from '@appTypes/infra/audioTag';

/** 封面超过此大小不写入 */
const MAX_COVER_BYTES = 10 * 1024 * 1024;

/** 按文件头识别图片格式；无法识别时返回 null */
function detectImageMime(data: Uint8Array): string | null {
    if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
        return 'image/png';
    }
    return null;
}

/** 取歌曲封面（http(s) 地址或 data URL）；取不到或不是 JPEG / PNG 时返回 undefined，signal 中止时抛错 */
export async function fetchCover(
    artwork: string | undefined,
    signal?: AbortSignal,
): Promise<IAudioTags['cover']> {
    if (!artwork) return undefined;
    let data: Uint8Array;
    if (artwork.startsWith('data:')) {
        data = Buffer.from(artwork.slice(artwork.indexOf(',') + 1), 'base64');
    } else if (/^https?:\/\//i.test(artwork)) {
        const response = await axios.get<ArrayBuffer>(artwork, {
            responseType: 'arraybuffer',
            timeout: 10_000,
            maxContentLength: MAX_COVER_BYTES,
            signal,
        });
        data = new Uint8Array(response.data);
    } else {
        return undefined;
    }
    if (data.length === 0 || data.length > MAX_COVER_BYTES) return undefined;
    const mimeType = detectImageMime(data);
    return mimeType ? { data, mimeType } : undefined;
}
