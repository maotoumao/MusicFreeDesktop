/**
 * 下载完成后的完整性复核。
 *
 * 光看字节数不够：服务器可能「理直气壮」地只给一小段（试听片段、
 * 错误的资源、被截断的内容），这时候 content-length 和实际收到的字节数
 * 完全对得上，下载层挑不出任何毛病。
 *
 * 但这首歌标称多少秒是知道的 —— 把下下来的文件实际时长量一下，
 * 明显短于标称时长，就说明拿到的不是这首歌的完整音频。
 */

import { fsUtil } from "@shared/utils/renderer";
import { normalizeDuration } from "@/renderer/core/music-duration";

/** 实际时长不足标称时长这个比例，就认为文件不完整 */
const INCOMPLETE_RATIO = 0.5;
/** 量时长最多等这么久，超时了就当测不出来 */
const MEASURE_TIMEOUT = 10000;

/**
 * 量一个本地音频文件的实际时长（秒）。测不出来返回 0。
 */
export function measureAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
        const audio = new Audio();
        let settled = false;
        const finish = (duration: number) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            audio.removeAttribute("src");
            resolve(duration);
        };
        const timer = setTimeout(() => finish(0), MEASURE_TIMEOUT);
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            finish(isFinite(duration) && duration > 0 ? duration : 0);
        };
        audio.onerror = () => finish(0);
        audio.src = fsUtil.addFileScheme(filePath);
    });
}

/**
 * 复核下载下来的文件是不是完整的那首歌。
 *
 * @param filePath 下载到的文件路径
 * @param declaredDuration 歌曲标称时长（秒）
 * @returns true 表示文件可用；false 表示明显不完整，调用方应该把它删掉
 */
export async function verifyDownloadedFile(
    filePath: string,
    declaredDuration?: number | null,
): Promise<boolean> {
    const declared = normalizeDuration(declaredDuration ?? undefined);
    // 没有标称时长可比对，就没理由拦下来
    if (!declared) {
        return true;
    }
    const actual = await measureAudioDuration(filePath);
    // 量不出来（格式不支持、文件坏了等）就不拦，交给播放时的检查兜底
    if (!actual) {
        return true;
    }
    return actual >= declared * INCOMPLETE_RATIO;
}
