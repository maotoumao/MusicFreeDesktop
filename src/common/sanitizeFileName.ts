/**
 * 移除文件名中不允许的字符（Windows / macOS / Linux 通用）。
 *
 * 处理规则：
 * 1. 移除控制字符 (0x00-0x1F, 0x7F-0x9F)
 * 2. 将 < > : " / \ | ? * 替换为下划线
 * 3. 移除尾部空格和点（Windows 不允许）
 * 4. 空名称兜底为 '_'
 * 5. 截断至 maxLength 字符（默认 200），避免超出文件系统路径限制
 */
export default function sanitizeFileName(name: string, maxLength = 200): string {
    // 移除控制字符
    // eslint-disable-next-line no-control-regex
    let sanitized = name.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    // 替换文件系统非法字符
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');
    // 移除尾部空格和点
    sanitized = sanitized.replace(/[. ]+$/, '');
    // 空名称兜底
    if (!sanitized) sanitized = '_';
    // Windows 保留设备名兜底
    if (/^(CON|PRN|AUX|NUL|COM\d|LPT\d)$/i.test(sanitized)) {
        sanitized = '_' + sanitized;
    }
    return sanitized.length > maxLength ? sanitized.slice(0, maxLength) : sanitized;
}
