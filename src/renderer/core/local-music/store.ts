import Store from "@/common/store";

const localMusicListStore = new Store<IMusic.IMusicItem[]>([]);
export default localMusicListStore;