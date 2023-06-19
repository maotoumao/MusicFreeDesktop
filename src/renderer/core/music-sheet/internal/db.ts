import Dexie, { Table } from "dexie";


class MusicSheetDB extends Dexie {
  // 歌单信息，其中musiclist只存有platform和id
  sheets: Table<IMusic.IDBMusicSheetItem>;
  // musicstore 存有歌单内保存所有的音乐信息
  musicStore: Table<
    IMusic.IMusicItem & {
      $$ref: number; // 某个歌曲在歌单中被引用几次，数字
    }
  >;

  constructor() {
    super("musicSheetDB");
    this.version(1.0).stores({
      sheets: "&id, title, artist, createAt",
      musicStore: "[platform+id], title, artist, album,  $$ref",
    });
  }
}

const musicSheetDB = new MusicSheetDB();
export default musicSheetDB;
