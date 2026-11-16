import { contextBridge, ipcRenderer } from "electron";
import EventEmitter from "eventemitter3";
import { IAppState, ICommand, IPortMessage } from "@shared/message-bus/type";
import { getGlobalContext } from "@shared/global-context/preload";

const extPorts = new Map<number, MessagePort>();
const subscribedAppStates = new Map<string | number, Array<keyof IAppState>>();
/** 订阅了频谱帧的扩展窗口 id（可视化窗口） */
const visualizationSubscribers = new Set<number>();

const mainProcessSubscribedKeys: Array<keyof IAppState> = [
    "lyricText",
    "playerState",
    "repeatMode",
    "musicItem",
];
if (getGlobalContext().platform === "darwin") {
    mainProcessSubscribedKeys.push("lyricText");
}
subscribedAppStates.set("main", mainProcessSubscribedKeys);

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
});

function handleMessage(data: IPortMessage, from: number | null) {
    const { type, payload, timestamp } = data;
    if (type === "mount" || type === "unmount") {
    // those are not real message
        return;
    }

    if (type === "ping") {
    // 渲染进程发来的建连消息
        const expPort = extPorts.get(from);
        // 返回一个相同的ping
        if (expPort) {
            expPort.postMessage({
                type: "ping",
                timestamp: Date.now(),
            });
        }
    } else if (type === "subscribeAppState" && from !== null) {
    // @ts-ignore
        subscribedAppStates.set(from, payload);
    } else if (
        type === "command" &&
        (payload as { command: keyof ICommand }).command ===
            "SubscribeVisualization" &&
        from !== null
    ) {
        visualizationSubscribers.add(from);
    } else if (type === "requestFrame" && from !== null) {
        // 在 preload 内部闭环：直接调用主世界注册的回调。
        // 不能走 ipcRenderer.send——那是发往主进程的，主世界收不到。
        frameProvider?.(from);
    } else if (type === "command") {
        ee.emit("command", payload, from);
    }
}

/**
 * 把一帧音频分析数据回给订阅了频谱的扩展窗口。
 *
 * `to` 指定只回给发起请求的那个窗口；不传则广播给所有订阅者。
 */
function pushVisualizationFrame(
    frame: IVisualization.IAudioFrame,
    to?: number,
) {
    const targets = to !== undefined ? [to] : Array.from(visualizationSubscribers);
    targets.forEach((id) => {
        if (!visualizationSubscribers.has(id)) {
            return;
        }
        const expPort = extPorts.get(id);
        if (!expPort) {
            return;
        }
        expPort.postMessage({
            type: "visualizationFrame",
            payload: frame,
            timestamp: Date.now(),
        });
    });
}

/**
 * 主世界注册的取帧回调。
 *
 * renderer 的 webpack target 是 web，**不能 import electron**（仓库约定），
 * 所以主世界与 preload 之间靠 contextBridge 传函数：主世界把回调注册进来，
 * preload 收到取帧请求时直接调用它——函数体仍在主世界执行（analyser 在那边）。
 *
 * 注意**不能**用 ipcRenderer.send 转一手：那是发往**主进程**的，
 * 同一渲染进程的主世界根本收不到，帧通道会整条断掉。
 */
let frameProvider: ((from: number) => void) | null = null;

function setFrameProvider(provider: (from: number) => void) {
    frameProvider = provider;
}

function onCommand<K extends keyof ICommand>(
    command: K,
    cb: (data: ICommand[K], from: "main" | number) => void,
) {
    ee.on("command", (payload, from) => {
        if (payload.command === command) {
            cb?.(payload.data, from);
        }
    });
}

function sendCommand<K extends keyof ICommand>(command: K, data: ICommand[K]) {
    ee.emit(
        "command",
        {
            command: command,
            data: data,
            timestamp: Date.now(),
        },
        -1,
    );
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
        });
        if (cnt) {
            expPort.postMessage({
                type: "syncAppState",
                payload: data,
                timestamp: Date.now(),
            });
        }
    }
}

const mod = {
    syncAppState,
    onCommand,
    sendCommand,
    pushVisualizationFrame,
    setFrameProvider,
};

contextBridge.exposeInMainWorld("@shared/message-bus/main", mod);
