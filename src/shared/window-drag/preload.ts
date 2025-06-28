import { contextBridge, ipcRenderer } from "electron";

function dragWindow(position: ICommon.IPoint) {
    ipcRenderer.send("set-window-draggable", position);
}

const mod = {
    dragWindow,
};

contextBridge.exposeInMainWorld("@shared/window-drag", mod);

