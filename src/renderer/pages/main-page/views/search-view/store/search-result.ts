/** 搜索状态 */

import { RequestStateCode } from "@/common/constant";
import Store from "@/common/store";

export interface ISearchResult<T extends IMedia.SupportMediaType> {
  /** 当前页码 */
  page?: number;
  /** 搜索词 */
  query?: string;
  /** 搜索状态 */
  state: RequestStateCode;
  /** 数据 */
  data: IMedia.SupportMediaItem[T][];
}

type ISearchResults<
  T extends keyof IMedia.SupportMediaItem = IMedia.SupportMediaType
> = {
  [K in T]: Record<string, ISearchResult<K>>;
};

/** 初始值 */
export const initSearchResults: ISearchResults = {
  music: {},
  album: {},
  artist: {},
  sheet: {},
  lyric: {}
};

/** key: pluginhash value: searchResult */
const searchResultsStore = new Store(initSearchResults);

const currentMediaTypeStore = new Store<IMedia.SupportMediaType>("music");

export { searchResultsStore, currentMediaTypeStore };

export function resetStore(){
  currentMediaTypeStore.setValue("music");
  searchResultsStore.setValue(initSearchResults);
}
