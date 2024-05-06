import { getAppConfigPath } from "@/common/app-config/renderer";
import { getUserPerferenceIDB, setUserPerferenceIDB } from "./user-perference";

export async function getSearchHistory() {
    return await getUserPerferenceIDB("searchHistory") ?? [];
}


export async function addSearchHistory(searchItem: string){
    const oldSearchHistory = await getSearchHistory();
    const maxHistoryLen = getAppConfigPath("normal.maxHistoryLength");
    const newSearchHistory = [searchItem, ...oldSearchHistory.filter(item => item !== searchItem)].slice(0, maxHistoryLen);
    await setUserPerferenceIDB("searchHistory", newSearchHistory);
}


export async function removeSearchHistory(searchItem: string) {
    const oldSearchHistory = await getSearchHistory();
    const newSearchHistory = oldSearchHistory.filter(item => item !== searchItem);
    await setUserPerferenceIDB("searchHistory", newSearchHistory);
}

export async function clearSearchHistory(){
    await setUserPerferenceIDB("searchHistory", []);
}