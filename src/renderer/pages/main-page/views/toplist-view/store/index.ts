import { RequestStateCode } from "@/common/constant";
import Store from "@/common/store";

export interface IPluginTopListResult {
    state: RequestStateCode;
    data: IMusic.IMusicSheetGroupItem[];
}

export const pluginsTopListStore = new Store<Record<string, IPluginTopListResult>>({});

