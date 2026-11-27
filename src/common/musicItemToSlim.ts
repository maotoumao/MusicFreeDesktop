import type { IMusicItemSlim } from '@appTypes/infra/playlist';
import { INTERNAL_SLIM_KEY } from './constant';

/**
 * 将 IMusicItem（插件返回的完整歌曲数据）转换为 IMusicItemSlim（列表展示用 7 字段精简版）。
 *
 * 已经是 slim 格式的对象传入也安全——缺失字段用默认值填充。
 */
export default function musicItemToSlim(item: IMusic.IMusicItem | IMusicItemSlim): IMusicItemSlim {
    return {
        platform: item.platform,
        id: String(item.id),
        title: musicItemText(item.title),
        artist: musicItemText(item.artist),
        album: musicItemText(item.album),
        duration: musicItemDuration(item.duration),
        artwork: musicItemArtwork(item),
        [INTERNAL_SLIM_KEY]: true,
    };
}

/** 歌曲的封面：只认字符串（含空串），其他值（如插件给的 NaN、false、对象）按没有封面处理 */
export function musicItemArtwork(item: { artwork?: unknown }): string | null {
    return typeof item.artwork === 'string' ? item.artwork : null;
}

/**
 * 写入数据库的完整歌曲数据：精简条目没有完整数据，返回 null；
 * 去掉不认的封面再序列化，序列化失败时返回 null（upsert 保留库里原有的完整数据）。
 */
export function musicItemRaw(item: IMusic.IMusicItem | IMusicItemSlim): string | null {
    if ((item as any)[INTERNAL_SLIM_KEY]) return null;
    try {
        return JSON.stringify(withoutInvalidArtwork(item)) ?? null;
    } catch {
        return null;
    }
}

/** 去掉不认的封面（非字符串且不是 undefined）后的歌曲；封面可用时返回原对象 */
export function withoutInvalidArtwork<T extends { artwork?: unknown }>(item: T): T {
    return item.artwork === undefined || typeof item.artwork === 'string'
        ? item
        : { ...item, artwork: undefined };
}

/** 歌曲的文字字段（标题、歌手、专辑）：字符串原样，有限数字转成文字，其他值（缺失、对象、布尔等）为空串 */
export function musicItemText(value: unknown): string {
    if (typeof value === 'string') return value;
    return Number.isFinite(value) ? String(value) : '';
}

/** 歌曲时长：有限数字，或能转成有限数字的非空字符串；其他值为 null */
export function musicItemDuration(value: unknown): number | null {
    const duration = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return Number.isFinite(duration) ? (duration as number) : null;
}
