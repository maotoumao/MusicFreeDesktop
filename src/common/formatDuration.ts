/**
 * 将秒数格式化为时间字符串。
 * - 不足 1 小时：m:ss（如 3:05）
 * - 超过 1 小时：h:mm:ss（如 1:02:05）
 * - 无效值（null / undefined / NaN / ≤0）：'--:--'
 */
export default function formatDuration(seconds: number | undefined | null): string {
    if (seconds == null || !isFinite(seconds) || seconds <= 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}
