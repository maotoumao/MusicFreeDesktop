/**
 * musicSheet — Preload 层
 *
 * 职责：纯桥接，通过 contextBridge 暴露歌单管理接口。
 *
 * 暴露名称：'@infra/music-sheet'
 */
import { contextBridge, ipcRenderer } from 'electron';
import type {
    ICreateSheetParams,
    IUpdateSheetParams,
    IMusicItemSlim,
} from '@appTypes/infra/musicSheet';
import { IPC, CONTEXT_BRIDGE_KEY, type IMusicSheetEvent } from './common/constant';

const mod = {
    // ─── 歌单 ───
    getAllSheets: () => ipcRenderer.invoke(IPC.GET_ALL_SHEETS),
    getSheetDetail: (sheetId: string) => ipcRenderer.invoke(IPC.GET_SHEET_DETAIL, sheetId),
    createSheet: (params: ICreateSheetParams) => ipcRenderer.invoke(IPC.CREATE_SHEET, params),
    deleteSheet: (sheetId: string) => ipcRenderer.invoke(IPC.DELETE_SHEET, sheetId),
    updateSheet: (params: IUpdateSheetParams) => ipcRenderer.invoke(IPC.UPDATE_SHEET, params),
    clearSheet: (sheetId: string) => ipcRenderer.invoke(IPC.CLEAR_SHEET, sheetId),

    // ─── 歌曲 ───
    addMusic: (sheetId: string, musicItems: Array<IMusic.IMusicItem | IMusicItemSlim>) =>
        ipcRenderer.invoke(IPC.ADD_MUSIC, sheetId, musicItems),
    removeMusic: (sheetId: string, musicBases: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.REMOVE_MUSIC, sheetId, musicBases),
    removeFromAllSheets: (musicBases: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.REMOVE_FROM_ALL_SHEETS, musicBases),
    updateMusicOrder: (sheetId: string, orderedKeys: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.UPDATE_MUSIC_ORDER, sheetId, orderedKeys),
    getRawMusicItem: (platform: string, id: string) =>
        ipcRenderer.invoke(IPC.GET_RAW_MUSIC_ITEM, platform, id),
    getRawMusicItems: (keys: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.GET_RAW_MUSIC_ITEMS, keys),

    // ─── 星标远程歌单 ───
    getStarredSheets: () => ipcRenderer.invoke(IPC.GET_STARRED_SHEETS),
    starSheet: (sheet: IMusic.IMusicSheetItem) => ipcRenderer.invoke(IPC.STAR_SHEET, sheet),
    unstarSheet: (platform: string, id: string) =>
        ipcRenderer.invoke(IPC.UNSTAR_SHEET, platform, id),
    setStarredOrder: (orderedKeys: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.SET_STARRED_ORDER, orderedKeys),

    // ─── 播放队列 ───
    playQueueGetAll: () => ipcRenderer.invoke(IPC.PLAY_QUEUE_GET_ALL),
    playQueueSet: (items: IMusic.IMusicItem[], fromSheetId?: string) =>
        ipcRenderer.invoke(IPC.PLAY_QUEUE_SET, items, fromSheetId),
    playQueueAdd: (items: IMusic.IMusicItem[], afterIndex: number) =>
        ipcRenderer.invoke(IPC.PLAY_QUEUE_ADD, items, afterIndex),
    playQueueRemove: (musicBases: IMedia.IMediaBase[]) =>
        ipcRenderer.invoke(IPC.PLAY_QUEUE_REMOVE, musicBases),
    playQueueClear: () => ipcRenderer.invoke(IPC.PLAY_QUEUE_CLEAR),

    // ─── 事件 ───
    onMusicSheetEvent: (cb: (event: IMusicSheetEvent) => void): (() => void) => {
        const handler = (_ipcEvt: unknown, event: IMusicSheetEvent) => cb(event);
        ipcRenderer.on(IPC.MUSIC_SHEET_EVENT, handler);
        return () => {
            ipcRenderer.removeListener(IPC.MUSIC_SHEET_EVENT, handler);
        };
    },
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
