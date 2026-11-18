import { HotPatcher } from "hot-patcher";
let __patcher = null;
export function getPatcher() {
    if (!__patcher) {
        __patcher = new HotPatcher();
    }
    return __patcher;
}
