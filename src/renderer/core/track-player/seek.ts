/**
 * 计算快进/快退之后应跳到的位置（秒）。
 *
 * 上界夹到曲目时长——流媒体源常见 `duration` 为 `Infinity`/`NaN`（元数据尚未加载），
 * 这时不夹上界；下界永远夹到 0，因为给 `audio.currentTime` 赋负数会抛错。
 */
export function getSeekTarget(
    currentTime: number,
    duration: number,
    delta: number,
): number {
    const base = Number.isFinite(currentTime) ? currentTime : 0;
    const upper = Number.isFinite(duration) && duration >= 0 ? duration : Infinity;
    return Math.min(Math.max(base + delta, 0), upper);
}
