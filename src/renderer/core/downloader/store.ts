import Store from "@/common/store";

const downloadingMusicStore = new Store<Array<IMusic.IMusicItem>>([]);
export { downloadingMusicStore };
