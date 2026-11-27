/** 歌单类型 */
export type PlaylistType = 'user' | 'system';

/**
 * 歌曲精简信息（列表展示、播放队列）。
 *
 * 对应 `IMusic.IMusicItem` 的本地持久化精简版：
 * - IMusicItem：插件返回的完整歌曲数据（含 url / rawLrc / 任意扩展字段）
 * - IMusicItemSlim：仅保留列表展示所需的 7 个固定字段
 *
 * 完整原始数据通过 `music_items.raw` 列以 JSON 存储，按需读取。
 */
export interface IMusicItemSlim {
    platform: string;
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number | null;
    artwork: string | null;
    /** 内部标记：该对象为精简版，不含完整 raw 数据 */
    readonly $slim?: true;
}

/**
 * 本地歌单元数据（不含歌曲列表）。
 *
 * 与 `IMusic.IPlaylistItem`（插件返回的远程歌单）的区别：
 * - IPlaylistItem：插件侧的歌单结构，字段松散（含 musicList / playCount 等）
 * - ILocalPlaylistMeta：本地 SQLite 存储的歌单结构，字段严格固定
 */
export interface ILocalPlaylistMeta {
    id: string;
    title: string;
    artwork: string | null;
    description: string | null;
    type: PlaylistType;
    folderPath: string | null;
    sortOrder: number;
    worksNum: number;
    createdAt: number;
    updatedAt: number;
    /** 歌单内最近加入的歌曲封面（仅当 artwork 为空时由 SQL 派生） */
    latestArtwork: string | null;
}

/** 歌单详情（含全量歌曲列表，slim 模式） */
export interface ILocalPlaylistDetail extends ILocalPlaylistMeta {
    musicList: IMusicItemSlim[];
}

/** 向歌单添加歌曲的选项 */
export interface IAddMusicOptions {
    /** 返回库里保留的封面（keptArtworks）；目标歌单正显示在界面上时才需要 */
    reportArtworks?: boolean;
}

/** 向歌单添加歌曲的结果 */
export interface IAddMusicResult {
    added: number;
    /** 超出歌单上限、没有写入的末尾歌曲数 */
    truncated: number;
    /**
     * 同一批里都没带封面的歌曲在库里的封面（upsert 时封面为 null 保留原值；空串也返回），
     * 包括已在歌单里的；只在 reportArtworks 时返回，渲染层据此纠正显示的封面
     */
    keptArtworks?: Array<{ platform: string; id: string; artwork: string }>;
}

/** 创建歌单参数 */
export interface ICreatePlaylistParams {
    title: string;
    artwork?: string;
    description?: string;
    type?: PlaylistType;
    folderPath?: string;
}

/** 更新歌单参数（部分更新） */
export interface IUpdatePlaylistParams {
    id: string;
    title?: string;
    artwork?: string;
    description?: string;
    sortOrder?: number;
}

/** 星标远程歌单（本地存储） */
export interface IStarredPlaylistItem {
    platform: string;
    id: string;
    title: string | null;
    artwork: string | null;
    raw: string;
    sortOrder: number;
    starredAt: number;
}

/** 歌曲完整数据查询接口（解决 slim → full） */
export interface IMusicItemProvider {
    /** 根据 platform + id 查询完整 raw JSON，不存在时返回 null */
    getRawMusicItem(platform: string, id: string): IMusic.IMusicItem | null;
}
