import { ipcMainHandle, ipcMainOn } from "@/common/ipc-util/main";
import { getMainWindow } from "../window";
import { net } from "electron";
import axios from "axios";

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

