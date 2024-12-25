import {contextBridge, ipcRenderer} from "electron";
import EventEmitter from "eventemitter3";
import {IAppState, ICommand, IPortMessage} from "@shared/message-bus/type";
import {getGlobalContext} from "@shared/global-context/preload";

const extPorts = new Map<number, MessagePort>();
const subscribedAppStates = new Map<string | number, Array<keyof IAppState>>();

const mainProcessSubscribedKeys: Array<keyof IAppState> = ["lyricText", "playerState", "repeatMode", "musicItem"];
if (getGlobalContext().platform === "darwin") {
    mainProcessSubscribedKeys.push("lyricText");
}
subscribedAppStates.set("main", mainProcessSubscribedKeys)

const ee = new EventEmitter();

//@ts-ignore
window.__extPorts = extPorts;

// 主窗口的端口信息 (和拓展端口通信)
ipcRenderer.on("port", (e, message) => {
    // 接收到端口，使其全局可用
    if (message.type === "mount") {
        const expPort = e.ports[0];
        extPorts.set(message.payload, expPort);
        expPort.onmessage = (evt) => {
            const data = evt.data;
            handleMessage(data, message.payload);
        };
    } else if (message.type === "unmount") {
        const closeId = message.payload;
        const expPort = extPorts.get(closeId);
        if (expPort) {
            expPort.close();
            extPorts.delete(closeId);
            subscribedAppStates.delete(closeId);
        }
    } else {
        // 其他类型作为主进程发来的普通消息处理
        handleMessage(message, null);
    }
});

ipcRenderer.on("@shared/message-bus/message", (_evt, message) => {
    handleMessage(message, null);
})

function handleMessage(data: IPortMessage, from: number | null) {
    const {type, payload, timestamp} = data;
    if (type === "mount" || type === "unmount") {
        // those are not real message
        return;
    }

    if (type === "subscribeAppState" && from !== null) {
        // @ts-ignore
        subscribedAppStates.set(from, payload);
    } else if (type === "command") {
        ee.emit("command", payload, from);
    }
}

function onCommand<K extends keyof ICommand>(command: K, cb: (data: ICommand[K], from: "main" | number) => void) {
    ee.on("command", (payload, from) => {
        if (payload.command === command) {
            cb?.(payload.data, from);
        }
    });
}

function sendCommand<K extends keyof ICommand>(command: K, data: ICommand[K]) {
    ee.emit("command", {
        command: command,
        data: data,
        timestamp: Date.now()
    }, -1);
}

function syncAppState(appState: IAppState, to?: "main" | number) {
    if (to !== undefined) {
        syncAppStateTo(appState, to);
        return;
    }
    // 同步全部
    syncAppStateTo(appState, "main");

    for (const key of extPorts.keys()) {
        syncAppStateTo(appState, key);
    }
}

function syncAppStateTo(appState: IAppState, processId: "main" | number) {
    const data: IAppState = {};
    if (processId === "main") {
        const mainSubscribedKeys = subscribedAppStates.get(processId);
        let cnt = 0;
        mainSubscribedKeys.forEach((key) => {
            if (appState[key] !== undefined) {
                // @ts-ignore
                data[key] = appState[key];
                ++cnt;
            }
        });
        if (cnt) {
            ipcRenderer.send("@shared/message-bus/sync-app-state", data);
        }
        return;
    }

    const expPort = extPorts.get(processId);
    const subscribedKeys = subscribedAppStates.get(processId);
    if (subscribedKeys && expPort) {
        const data: IAppState = {};
        let cnt = 0;
        subscribedKeys.forEach((key) => {
            if (appState[key] !== undefined) {
                // @ts-ignore
                data[key] = appState[key];
                ++cnt;
            }
        })
        if (cnt) {
            expPort.postMessage({
                type: "syncAppState",
                payload: data,
                timestamp: Date.now()
            });
        }
    }

}

const mod = {
    syncAppState,
    onCommand,
    sendCommand
};

contextBridge.exposeInMainWorld("@shared/message-bus/main", mod);
