import { contextBridge } from "electron";
import "./db-init";
import * as LocalMusicSheet from "./local-music-sheet";
import * as LocalMusicItems from "./local-music-items";
import * as StarredMusicSheets from "./starred-music-sheets";

const LocalMusicSheetDB = {
    // 歌单操作
    addMusicSheet: LocalMusicSheet.addMusicSheet,
    batchAddMusicSheets: LocalMusicSheet.batchAddMusicSheets,
    deleteMusicSheet: LocalMusicSheet.deleteMusicSheet,
    batchDeleteMusicSheets: LocalMusicSheet.batchDeleteMusicSheets,
    getMusicSheet: LocalMusicSheet.getMusicSheet,
    getAllMusicSheets: LocalMusicSheet.getAllMusicSheets,
    getMusicSheetsByPlatform: LocalMusicSheet.getMusicSheetsByPlatform,
    updateMusicSheet: LocalMusicSheet.updateMusicSheet,
    clearAllMusicItemsInSheet: LocalMusicSheet.clearAllMusicItemsInSheet,
    existsMusicSheet: LocalMusicSheet.existsMusicSheet,
    searchMusicSheets: LocalMusicSheet.searchMusicSheets,
    getMusicSheetCount: LocalMusicSheet.getMusicSheetCount,
    batchMoveMusicSheets: LocalMusicSheet.batchMoveMusicSheets,

    // 歌曲操作
    addMusicItemToSheet: LocalMusicItems.addMusicItemToSheet,
    batchAddMusicItemsToSheet: LocalMusicItems.batchAddMusicItemsToSheet,
    deleteMusicItemFromSheet: LocalMusicItems.deleteMusicItemFromSheet,
    batchDeleteMusicItemsFromSheet: LocalMusicItems.batchDeleteMusicItemsFromSheet,
    getMusicItemInSheet: LocalMusicItems.getMusicItemInSheet,
    getMusicItemsInSheet: LocalMusicItems.getMusicItemsInSheet,
    getMusicItemsInSheetPaginated: LocalMusicItems.getMusicItemsInSheetPaginated,
    updateMusicItemInSheet: LocalMusicItems.updateMusicItemInSheet,
    searchMusicItemsInSheet: LocalMusicItems.searchMusicItemsInSheet,
    getMusicItemCountInSheet: LocalMusicItems.getMusicItemCountInSheet,
    existsMusicItemInSheet: LocalMusicItems.existsMusicItemInSheet,
    batchMoveMusicItemsInSheet: LocalMusicItems.batchMoveMusicItemsInSheet,
};

const StarredMusicSheetDB = {
    addStarredMusicSheet: StarredMusicSheets.addStarredMusicSheet,
    batchAddStarredMusicSheets: StarredMusicSheets.batchAddStarredMusicSheets,
    deleteStarredMusicSheet: StarredMusicSheets.deleteStarredMusicSheet,
    batchDeleteStarredMusicSheets: StarredMusicSheets.batchDeleteStarredMusicSheets,
    getStarredMusicSheet: StarredMusicSheets.getStarredMusicSheet,
    getAllStarredMusicSheets: StarredMusicSheets.getAllStarredMusicSheets,
    getStarredMusicSheetsByPlatform: StarredMusicSheets.getStarredMusicSheetsByPlatform,
    updateStarredMusicSheet: StarredMusicSheets.updateStarredMusicSheet,
    searchStarredMusicSheets: StarredMusicSheets.searchStarredMusicSheets,
    getStarredMusicSheetCount: StarredMusicSheets.getStarredMusicSheetCount,
    isStarredMusicSheet: StarredMusicSheets.isStarredMusicSheet,
    getStarredMusicSheetsPaginated: StarredMusicSheets.getStarredMusicSheetsPaginated,
    batchMoveStarredMusicSheets: StarredMusicSheets.batchMoveStarredMusicSheets,
};

const mod = { LocalMusicSheetDB, StarredMusicSheetDB };

contextBridge.exposeInMainWorld("@shared/database", mod);
