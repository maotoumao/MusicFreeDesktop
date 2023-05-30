import { ipcMainOn } from "@/common/ipcUtil/main";
import { getMainWindow } from "../window";

export default function initIpcMain(){
    ipcMainOn('min-window', ({
        skipTaskBar
    }) => {
        const mainWindow = getMainWindow();
        if(mainWindow) {
            if(skipTaskBar) {
                mainWindow.hide();
            }
            mainWindow.minimize();
        }
    })
}