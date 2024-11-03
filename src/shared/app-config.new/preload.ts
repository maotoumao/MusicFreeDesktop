import { contextBridge, ipcRenderer } from "electron";


async function syncConfig() {
    return await ipcRenderer.invoke("sync-app-config");
}

function setConfig(config: any) {
    return ipcRenderer.send("set-app-config", config);
}

function onConfigUpdate(callback: (patch: any) => void) {
    ipcRenderer.on("sync-app-config", (_event, patch) => {
        callback(patch);
    });
}


const mod = {
    syncConfig,
    setConfig,
    onConfigUpdate
}

contextBridge.exposeInMainWorld("@shared/app-config", mod);

