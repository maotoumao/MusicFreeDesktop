import { getAppConfigPath } from "@/shared/app-config/renderer";
import { getUserPreferenceIDB, setUserPreferenceIDB } from "./user-perference";

export async function getSearchHistory() {
  return (await getUserPreferenceIDB("searchHistory")) ?? [];
}

export async function addSearchHistory(searchItem: string) {
  const oldSearchHistory = await getSearchHistory();
  const maxHistoryLen = getAppConfigPath("normal.maxHistoryLength");
  const newSearchHistory = [
    searchItem,
    ...oldSearchHistory.filter((item) => item !== searchItem),
  ].slice(0, maxHistoryLen);
  await setUserPreferenceIDB("searchHistory", newSearchHistory);
}

export async function removeSearchHistory(searchItem: string) {
  const oldSearchHistory = await getSearchHistory();
  const newSearchHistory = oldSearchHistory.filter(
    (item) => item !== searchItem
  );
  await setUserPreferenceIDB("searchHistory", newSearchHistory);
}

export async function clearSearchHistory() {
  await setUserPreferenceIDB("searchHistory", []);
}
