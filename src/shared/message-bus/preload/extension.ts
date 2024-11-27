import {contextBridge, ipcRenderer} from "electron";
import {IAppState, ICommand} from "@shared/message-bus/type";
import EventEmitter from "eventemitter3";

let extPort: MessagePort = null;
let appState: IAppState = {}
const ee = new EventEmitter<{
    stateChanged: [IAppState, IAppState]
}>()

ipcRenderer.on("port", (e) => {
    extPort = e.ports[0];
    extPort.onmessage = (evt) => {
        const data = evt.data;

        if (data.type === "syncAppState") {
            appState = {
                ...appState,
                ...(data.payload || {}),
            }
            console.log("AppStateChanged", appState);
            ee.emit("stateChanged", appState, data.payload || {});
        }

    };
});

function sendCommand<T extends keyof ICommand>(command: T, data?: ICommand[T]) {
    if (!extPort) {
        return;
    }
    extPort.postMessage({
        type: "command",
        payload: {
            command,
            data
        },
        timestamp: Date.now()
    });
}

function subscribeAppState(keys: (keyof IAppState)[]) {
    if (!extPort) {
        return;
    }
    extPort.postMessage({
        type: "subscribeAppState",
        payload: keys,
        timestamp: Date.now()
    });
}


function getAppState() {
    return appState;
}


function onStateChange(cb: (appState: IAppState, changedAppState: IAppState) => void) {
    ee.on("stateChanged", cb);
}

function offStateChange(cb: (appState: IAppState, changedAppState: IAppState) => void) {
    ee.off("stateChanged", cb);
}

const mod = {
    getAppState,
    subscribeAppState,
    sendCommand,
    onStateChange,
    offStateChange
};

contextBridge.exposeInMainWorld("@shared/message-bus/extension", mod);
