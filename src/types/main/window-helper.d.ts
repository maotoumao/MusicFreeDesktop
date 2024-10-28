import type {WindowType, WindowRole} from "@/common/constant";
import type {BrowserWindow} from "electron";

interface IWindowConfig {
    role: WindowRole;
    type: WindowType;
    window: BrowserWindow;
}

export interface IWindowHelper {
    getWindows: () => IWindowConfig;

}
