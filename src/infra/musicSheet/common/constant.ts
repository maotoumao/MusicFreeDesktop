/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/music-sheet';

/** 每歌单最大歌曲数 */
export const MAX_MUSIC_PER_SHEET = 100_000;

/** 播放队列最大长度 */
export const MAX_QUEUE_SIZE = 100_000;

/** 默认收藏歌单 ID（固定，不可删除） */
export const DEFAULT_FAVORITE_SHEET_ID = 'favorite';

/** 播放队列虚拟歌单 ID */
export const PLAY_QUEUE_SHEET_ID = '__play_queue__';

/** 已下载歌单 ID（系统歌单，不可删除） */
export const DOWNLOADED_SHEET_ID = '__downloaded__';

/**
 * musicSheet 模块广播事件的 payload。
 *
 * @property origin 事件来源：
 *   - 'user'：renderer 用户操作通过 IPC 触发，renderer 已通过乐观更新处理了 musicList，
 *              只需刷新 sheetsAtom（歌单元数据如 worksNum）。
 *   - 'internal'：main 进程内部模块（如 downloadManager）通过 DI 触发，
 *              renderer 无感知，需要同时刷新 sheetsAtom 和 musicListAtom。
 * @property sheetId 受影响的歌单 ID，不传表示影响所有歌单。
 */
export interface IMusicSheetEvent {
    origin: 'user' | 'internal';
    sheetId?: string;
}

/** IPC 通道 */
export const IPC = {
    // ─── 歌单 CRUD ───
    GET_ALL_SHEETS: '@infra/music-sheet/get-all-sheets',
    GET_SHEET_DETAIL: '@infra/music-sheet/get-sheet-detail',
    CREATE_SHEET: '@infra/music-sheet/create-sheet',
    DELETE_SHEET: '@infra/music-sheet/delete-sheet',
    UPDATE_SHEET: '@infra/music-sheet/update-sheet',
    CLEAR_SHEET: '@infra/music-sheet/clear-sheet',

    // ─── 歌曲操作 ───
    ADD_MUSIC: '@infra/music-sheet/add-music',
    REMOVE_MUSIC: '@infra/music-sheet/remove-music',
    REMOVE_FROM_ALL_SHEETS: '@infra/music-sheet/remove-from-all-sheets',
    UPDATE_MUSIC_ORDER: '@infra/music-sheet/update-music-order',
    GET_RAW_MUSIC_ITEM: '@infra/music-sheet/get-raw-music-item',
    GET_RAW_MUSIC_ITEMS: '@infra/music-sheet/get-raw-music-items',

    // ─── 星标远程歌单 ───
    GET_STARRED_SHEETS: '@infra/music-sheet/get-starred-sheets',
    STAR_SHEET: '@infra/music-sheet/star-sheet',
    UNSTAR_SHEET: '@infra/music-sheet/unstar-sheet',
    SET_STARRED_ORDER: '@infra/music-sheet/set-starred-order',

    // ─── 广播事件 ───
    MUSIC_SHEET_EVENT: '@infra/music-sheet/event',

    // ─── 播放队列 ───
    PLAY_QUEUE_GET_ALL: '@infra/music-sheet/play-queue/get-all',
    PLAY_QUEUE_SET: '@infra/music-sheet/play-queue/set',
    PLAY_QUEUE_ADD: '@infra/music-sheet/play-queue/add',
    PLAY_QUEUE_REMOVE: '@infra/music-sheet/play-queue/remove',
    PLAY_QUEUE_CLEAR: '@infra/music-sheet/play-queue/clear',
} as const;
