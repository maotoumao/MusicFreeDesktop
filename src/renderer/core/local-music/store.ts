import Store from "@/common/store";

const localMusicListStore = new Store<Array<IMusic.IMusicItem & {
    $$localPath: string
}>>([]);
export default localMusicListStore;