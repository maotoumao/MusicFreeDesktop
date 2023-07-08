import Store from "@/common/store";
import defaultSheet from "./default-sheet";

export const musicSheetsStore = new Store<IMusic.IDBMusicSheetItem[]>([defaultSheet]);
export const starredSheetsStore = new Store<IMedia.IMediaBase[]>([]);