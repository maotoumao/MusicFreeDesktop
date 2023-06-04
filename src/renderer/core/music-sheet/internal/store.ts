import Store from "@/common/store";
import defaultSheet from "./default-sheet";

export const musicSheetsStore = new Store<IMusic.IMusicSheetItem[]>([defaultSheet]);
export const currentMusicSheetStore = new Store<IMusic.IMusicSheetItem | null>(null);