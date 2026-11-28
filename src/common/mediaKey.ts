/**
 * 生成媒体资源的复合键（platform + id）。
 * 用于在 Set / Map 中快速查找。
 */
export function compositeKey(platform: string, id: string): string {
    return `${platform}\0${String(id)}`;
}

/** 判断两个媒体资源是否为同一首（platform + id 相等） */
export function isSameMedia(
    a: IMedia.IMediaBase | null | undefined,
    b: IMedia.IMediaBase | null | undefined,
): boolean {
    if (!a || !b) return false;
    return a.platform === b.platform && String(a.id) === String(b.id);
}
