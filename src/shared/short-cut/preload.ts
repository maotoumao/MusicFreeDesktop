import { contextBridge, ipcRenderer } from "electron";


function registerGlobalShortCut(key: string, shortCut: string[]) {
    ipcRenderer.send("@shared/short-cut/register-global-short-cut", key, shortCut);
}

function unregisterGlobalShortCut(key: string) {
    ipcRenderer.send("@shared/short-cut/unregister-global-short-cut", key);
}

const mod = {
    registerGlobalShortCut,
    unregisterGlobalShortCut
};

contextBridge.exposeInMainWorld("@shared/short-cut", mod);
