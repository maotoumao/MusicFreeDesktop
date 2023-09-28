import { RequestStateCode } from "@/common/constant";
import Store from "@/common/store";

export interface ISearchLyricResult {
    data: ILyric.ILyricItem[];
    state: RequestStateCode;
    page: number;
}

interface ISearchLyricStoreData {
    query?: string;
    // plugin - result
    data: Record<string, ISearchLyricResult>;
}

export default new Store<ISearchLyricStoreData>({data: {}});