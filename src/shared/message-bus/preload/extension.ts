import { contextBridge, ipcRenderer } from "electron";
import { IAppState, ICommand, IPortMessage } from "@shared/message-bus/type";
import EventEmitter from "eventemitter3";

let extPort: MessagePort = null;
let appState: IAppState = {};
const ee = new EventEmitter<{
    stateChanged: [IAppState, IAppState];
    visualizationFrame: [IVisualization.IAudioFrame];
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
        } else if (data.type === "visualizationFrame") {
            ee.emit("visualizationFrame", data.payload);
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

/**
 * 向主窗口请求一帧音频分析数据（pull 模型）。
 *
 * 由可视化窗口在自己的 rAF 里每帧调一次——主窗口最小化时它的 rAF 会被节流，
 * 但 IPC 回调不受影响，所以「可见窗口拉、隐藏窗口应」是唯一两边都不受影响的组合。
 */
function requestFrame() {
    const message: IPortMessage = {
        type: "requestFrame",
        payload: undefined,
        timestamp: Date.now(),
    };

    if (!extPort || !connected) {
        cachedMessages.push(message);
        return;
    }
    extPort.postMessage(message);
}

function onVisualizationFrame(cb: (frame: IVisualization.IAudioFrame) => void) {
    ee.on("visualizationFrame", cb);
}

function offVisualizationFrame(cb: (frame: IVisualization.IAudioFrame) => void) {
    ee.off("visualizationFrame", cb);
}

const mod = {
    getAppState,
    subscribeAppState,
    sendCommand,
    onStateChange,
    offStateChange,
    requestFrame,
    onVisualizationFrame,
    offVisualizationFrame,
};

contextBridge.exposeInMainWorld("@shared/message-bus/extension", mod);
