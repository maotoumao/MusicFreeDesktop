import { ipcRenderer } from "electron";

function on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
    return ipcRenderer.on(channel, listener);
}

function once(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
    return ipcRenderer.once(channel, listener);
}

function removeListener(channel: string, listener: (...args: any[]) => void) {
    return ipcRenderer.removeListener(channel, listener)
}

function removeAllListeners(channel: string) {
    return ipcRenderer.removeAllListeners(channel)
}


function send(channel: string, ...args: any[]) {
    return ipcRenderer.send(channel, ...args);
}

function invoke(channel: string, ...args: any[]) {
    return ipcRenderer.invoke(channel, ...args);
}


export default {
    on,
    once,
    removeAllListeners,
    removeListener,
    send,
    invoke
}

