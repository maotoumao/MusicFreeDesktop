/**
 * musicSheet — Preload 层
 *
 * 职责：纯桥接，通过 contextBridge 暴露歌单管理接口。
 *
 * 暴露名称：'@infra/music-sheet'
 */
import { contextBridge, ipcRenderer } from 'electron';
import type {
    ICreatePlaylistParams,
    IUpdatePlaylistParams,
    IMusicItemSlim,
} from '@appTypes/infra/playlist';
import { IPC, CONTEXT_BRIDGE_KEY, type IPlaylistEvent } from './common/constant';

const mod = {
    // ─── 歌单 ───
    getAllPlaylists: () => ipcRenderer.invoke(IPC.GET_ALL_PLAYLISTS),
    getPlaylistDetail: (playlistId: string) =>
        ipcRenderer.invoke(IPC.GET_PLAYLIST_DETAIL, playlistId),
    createPlaylist: (params: ICreatePlaylistParams) =>
        ipcRenderer.invoke(IPC.CREATE_PLAYLIST, params),
    deletePlaylist: (playlistId: string) => ipcRenderer.invoke(IPC.DELETE_PLAYLIST, playlistId),
    updatePlaylist: (params: IUpdatePlaylistParams) =>
        ipcRenderer.invoke(IPC.UPDATE_PLAYLIST, params),
    clearPlaylist: (playlistId: string) => ipcRenderer.invoke(IPC.CLEAR_PLAYLIST, playlistId),

    // ─── 歌曲 ───
    addMusic: (playlistId: string, musicItems: Array<IMusic.IMusicItem | IMusicItemSlim>) =>
        ipcRenderer.invoke(IPC.ADD_MUSIC, playlistId, musicItems),
    removeMusic: (playlistId: string, musicBases: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.REMOVE_MUSIC, playlistId, musicBases),
    removeFromAllPlaylists: (musicBases: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.REMOVE_FROM_ALL_PLAYLISTS, musicBases),
    updateMusicOrder: (playlistId: string, orderedKeys: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.UPDATE_MUSIC_ORDER, playlistId, orderedKeys),
    getRawMusicItem: (platform: string, id: string) =>
        ipcRenderer.invoke(IPC.GET_RAW_MUSIC_ITEM, platform, id),
    getRawMusicItems: (keys: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.GET_RAW_MUSIC_ITEMS, keys),

    // ─── 星标远程歌单 ───
    getStarredPlaylists: () => ipcRenderer.invoke(IPC.GET_STARRED_PLAYLISTS),
    starPlaylist: (playlist: IMusic.IPlaylistItem) =>
        ipcRenderer.invoke(IPC.STAR_PLAYLIST, playlist),
    unstarPlaylist: (platform: string, id: string) =>
        ipcRenderer.invoke(IPC.UNSTAR_PLAYLIST, platform, id),
    setStarredOrder: (orderedKeys: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.SET_STARRED_ORDER, orderedKeys),

    // ─── 播放队列 ───
    playQueueGetAll: () => ipcRenderer.invoke(IPC.PLAY_QUEUE_GET_ALL),
    playQueueSet: (items: IMusic.IMusicItem[], fromPlaylistId?: string) =>
        ipcRenderer.invoke(IPC.PLAY_QUEUE_SET, items, fromPlaylistId),
    playQueueAdd: (items: IMusic.IMusicItem[], afterIndex: number) =>
        ipcRenderer.invoke(IPC.PLAY_QUEUE_ADD, items, afterIndex),
    playQueueRemove: (musicBases: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.PLAY_QUEUE_REMOVE, musicBases),
    playQueueClear: () => ipcRenderer.invoke(IPC.PLAY_QUEUE_CLEAR),

    // ─── 事件 ───
    onPlaylistEvent: (cb: (event: IPlaylistEvent) => void): (() => void) => {
        const handler = (_ipcEvt: unknown, event: IPlaylistEvent) => cb(event);
        ipcRenderer.on(IPC.PLAYLIST_EVENT, handler);
        return () => {
            ipcRenderer.removeListener(IPC.PLAYLIST_EVENT, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
