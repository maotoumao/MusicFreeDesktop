import { contextBridge, ipcRenderer } from "electron";
import { IAppState, ICommand, IPortMessage } from "@shared/message-bus/type";
import EventEmitter from "eventemitter3";

let extPort: MessagePort = null;
let appState: IAppState = {};
const ee = new EventEmitter<{
    stateChanged: [IAppState, IAppState];
}>();

// 初始化
let connected = false;
let pingTimer: NodeJS.Timeout | null = null;
// 缓存未建立连接时的消息
const cachedMessages: IPortMessage[] = [];

ipcRenderer.on("port", (e) => {
    extPort = e.ports[0];
    pingTimer = setInterval(() => {
        console.log("ping");
        // 向主进程发送 ping
        extPort.postMessage({
            type: "ping",
            timestamp: Date.now(),
        });
    }, 300);
    extPort.onmessage = (evt) => {
        const data = evt.data;

        if (data.type === "syncAppState") {
            appState = {
                ...appState,
                ...(data.payload || {}),
            };
            ee.emit("stateChanged", appState, data.payload || {});
        } else if (data.type === "ping") {
            connected = true;
            clearInterval(pingTimer);
            pingTimer = null;
            if (cachedMessages.length) {
                cachedMessages.forEach((message) => {
                    extPort.postMessage(message);
                });
                cachedMessages.length = 0;
            }
        }
    };
});

function sendCommand<T extends keyof ICommand>(command: T, data?: ICommand[T]) {
    const message: IPortMessage = {
        type: "command",
        payload: {
            command,
            data,
        },
        timestamp: Date.now(),
    };

    if (!extPort || !connected) {
        cachedMessages.push(message);
        return;
    }
    extPort.postMessage(message);
}

function subscribeAppState(keys: (keyof IAppState)[]) {
    const message: IPortMessage = {
        type: "subscribeAppState",
        payload: keys,
        timestamp: Date.now(),
    };

    if (!extPort || !connected) {
        cachedMessages.push(message);
        return;
    }
    extPort.postMessage(message);
}

function getAppState() {
    return appState;
}

function onStateChange(
    cb: (appState: IAppState, changedAppState: IAppState) => void,
) {
    ee.on("stateChanged", cb);
}

function offStateChange(
    cb: (appState: IAppState, changedAppState: IAppState) => void,
) {
    ee.off("stateChanged", cb);
}

const mod = {
    getAppState,
    subscribeAppState,
    sendCommand,
    onStateChange,
    offStateChange,
};

contextBridge.exposeInMainWorld("@shared/message-bus/extension", mod);
