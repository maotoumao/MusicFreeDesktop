import Dexie, {Table} from "dexie";

class MusicSheetDB extends Dexie {
    // 歌单信息，其中musiclist只存有platform和id
    sheets: Table<IMusic.IMusicSheetItem>;
    // musicstore 存有歌单内保存所有的音乐信息
    musicStore: Table<IMusic.IMusicItem>; 

    constructor(){
        super('musicSheetDB');
        this.version(1.0).stores({
            sheets: '&id, title, artist, createAt',
            musicStore: '[platform+id], title, artist, album'
        })
    }
}

const musicSheetDB = new MusicSheetDB();
export default musicSheetDB;