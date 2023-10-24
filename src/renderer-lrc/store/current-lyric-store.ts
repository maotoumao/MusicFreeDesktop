import Store from "@/common/store";

export default new Store<{
  lrc?: ILyric.IParsedLrcItem; // 当前时刻的歌词
  index?: number; // 下标
}>({});
