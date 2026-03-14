import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
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
        title: item.title ?? '',
        artist: item.artist ?? '',
        album: item.album ?? '',
        duration: item.duration ?? null,
        artwork: item.artwork ?? null,
        [INTERNAL_SLIM_KEY]: true,
    };
}
