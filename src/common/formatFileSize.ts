const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * 将字节数格式化为人类可读的文件大小字符串。
 *
 * @param bytes - 字节数（非负整数）
 * @param decimals - 小数位数，默认 1
 * @returns 格式化后的字符串，如 `"12.5 MB"`
 */
export default function formatFileSize(bytes: number, decimals = 1): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${FILE_SIZE_UNITS[0]}`;

    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(decimals)} ${FILE_SIZE_UNITS[unitIndex]}`;
}
