import { rem } from "@/common/constant";
import Store from "@/common/store";

export const initValue = 184 + 4 * rem;
export const offsetHeightStore = new Store(initValue);