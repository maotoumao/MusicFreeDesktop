/**
 * pluginManager — 媒体项工具函数
 *
 * 提供 resetMediaItem（输出清洗）和 cleanMediaInput（输入清洗）等通用函数。
 * 在 main 和 renderer 进程中均可使用。
 */

/**
 * 重置单个媒体项：设置 platform，删除所有 $-前缀内部字段。
 * 用于插件方法返回值的标准化处理。
 */
export function resetMediaItem<T extends Partial<IMedia.IMediaBase>>(
    item: T | null | undefined,
    platform: string,
): T | null {
    if (!item) return null;

    item.platform = platform;
    if (item.id != null) {
        item.id = String(item.id);
    }
    // 删除所有 $-前缀的内部字段（$slim, $ 等）
    for (const key of Object.keys(item)) {
        if (key.startsWith('$')) {
            delete (item as Record<string, unknown>)[key];
        }
    }

    return item;
}

/**
 * 批量重置媒体项列表。
 */
export function resetMediaItems<T extends Partial<IMedia.IMediaBase>>(
    items: T[] | null | undefined,
    platform: string,
): T[] {
    if (!items || !Array.isArray(items)) return [];

    return items.map((item) => resetMediaItem(item, platform)).filter(Boolean) as T[];
}

/**
 * 清洗媒体项输入：删除所有 $-前缀内部字段，避免将内部状态传递给插件。
 * 返回浅拷贝，不修改原对象。
 */
export function cleanMediaInput<T extends Record<string, any>>(item: T): T {
    if (!item || typeof item !== 'object') return item;

    const cleaned = { ...item };
    for (const key of Object.keys(cleaned)) {
        if (key.startsWith('$')) {
            delete cleaned[key];
        }
    }

    return cleaned;
}
