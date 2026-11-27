/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/playlist';

/** 每歌单最大歌曲数 */
export const MAX_MUSIC_PER_PLAYLIST = 100_000;

/** 播放队列最大长度 */
export const MAX_QUEUE_SIZE = 100_000;

/** 默认收藏歌单 ID（固定，不可删除） */
export const DEFAULT_FAVORITE_PLAYLIST_ID = 'favorite';

/** 播放队列虚拟歌单 ID */
export const PLAY_QUEUE_PLAYLIST_ID = '__play_queue__';

/** 已下载歌单 ID（系统歌单，不可删除） */
export const DOWNLOADED_PLAYLIST_ID = '__downloaded__';

/**
 * playlist 模块广播事件的 payload。
 *
 * @property origin 事件来源：
 *   - 'user'：renderer 用户操作通过 IPC 触发，renderer 已通过乐观更新处理了 musicList，
 *              只需刷新 sheetsAtom（歌单元数据如 worksNum）。
 *   - 'internal'：main 进程内部模块（如 downloadManager）通过 DI 触发，
 *              renderer 无感知，需要同时刷新 sheetsAtom 和 musicListAtom。
 * @property sheetId 受影响的歌单 ID，不传表示影响所有歌单。
 */
export interface IPlaylistEvent {
    origin: 'user' | 'internal';
    sheetId?: string;
}

/** IPC 通道 */
export const IPC = {
    // ─── 歌单 CRUD ───
    GET_ALL_PLAYLISTS: '@infra/playlist/get-all-playlists',
    GET_PLAYLIST_DETAIL: '@infra/playlist/get-playlist-detail',
    CREATE_PLAYLIST: '@infra/playlist/create-playlist',
    DELETE_PLAYLIST: '@infra/playlist/delete-playlist',
    UPDATE_PLAYLIST: '@infra/playlist/update-playlist',
    CLEAR_PLAYLIST: '@infra/playlist/clear-playlist',

    // ─── 歌曲操作 ───
    ADD_MUSIC: '@infra/playlist/add-music',
    REMOVE_MUSIC: '@infra/playlist/remove-music',
    REMOVE_FROM_ALL_PLAYLISTS: '@infra/playlist/remove-from-all-playlists',
    UPDATE_MUSIC_ORDER: '@infra/playlist/update-music-order',
    GET_RAW_MUSIC_ITEM: '@infra/playlist/get-raw-music-item',
    GET_RAW_MUSIC_ITEMS: '@infra/playlist/get-raw-music-items',

    // ─── 星标远程歌单 ───
    GET_STARRED_PLAYLISTS: '@infra/playlist/get-starred-playlists',
    STAR_PLAYLIST: '@infra/playlist/star-playlist',
    UNSTAR_PLAYLIST: '@infra/playlist/unstar-playlist',
    SET_STARRED_ORDER: '@infra/playlist/set-starred-order',

    // ─── 广播事件 ───
    PLAYLIST_EVENT: '@infra/playlist/event',

    // ─── 播放队列 ───
    PLAY_QUEUE_GET_ALL: '@infra/playlist/play-queue/get-all',
    PLAY_QUEUE_SET: '@infra/playlist/play-queue/set',
    PLAY_QUEUE_ADD: '@infra/playlist/play-queue/add',
    PLAY_QUEUE_REMOVE: '@infra/playlist/play-queue/remove',
    PLAY_QUEUE_CLEAR: '@infra/playlist/play-queue/clear',
} as const;
