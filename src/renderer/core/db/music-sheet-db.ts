import { musicRefSymbol } from "@/common/constant";
import Dexie, { Table } from "dexie";

class MusicSheetDB extends Dexie {
    // 歌单信息，其中musiclist只存有platform和id
    sheets: Table<IMusic.IDBMusicSheetItem>;
    // musicstore 存有歌单内保存所有的音乐信息
    musicStore: Table<
    IMusic.IMusicItem & {
        [musicRefSymbol]: number; // 某个歌曲在歌单中被引用几次，数字
    }
    >;
    localMusicStore: Table<IMusic.IMusicItem & {
        $$localPath: string; // 本地地址
    }>;

    constructor() {
        super("musicSheetDB");
        this.version(1.1).stores({
            sheets: "&id, title, artist, createAt, $$sortIndex",
            musicStore: "[platform+id], title, artist, album",
            /** 本地音乐 */
            localMusicStore: "[platform+id], title, artist, album, $$localPath",
        });
    }
}

const musicSheetDB = new MusicSheetDB();
export default musicSheetDB;
