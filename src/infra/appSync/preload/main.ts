/**
 * appSync — 主窗口 Preload 层
 *
 * 职责:
 *  1. 管理与辅助窗口的 MessagePort 连接
 *  2. 按订阅过滤并推送状态到辅助窗口
 *  3. 同步状态到主进程
 *  4. 路由指令（来自辅助窗口 / 主进程 / 主窗口自身）
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { AppStateType, IAppState, IPortMessage } from '@appTypes/infra/appSync';
import type { WindowType } from '@appTypes/main/windowManager';
import EventEmitter from 'eventemitter3';
import { IPC, CONTEXT_BRIDGE_KEY } from '../common/constant';

// ─── 内部状态 ───

/** 辅助窗口的 MessagePort 集合 */
const auxiliaryPorts = new Map<WindowType, MessagePort>();

/** 各辅助窗口订阅的状态 key 列表 */
const auxiliarySubscriptions = new Map<WindowType, AppStateType[]>();

const ee = new EventEmitter();

// ─── 端口管理 ───

// 接收主进程转发的 MessagePort（辅助窗口 mount）
ipcRenderer.on(IPC.PORT, (e, data: { windowType: WindowType }) => {
    if (!data || !e.ports?.length) {
        return;
    }

    const { windowType } = data;
    const port = e.ports[0];
    auxiliaryPorts.set(windowType, port);

    port.onmessage = (evt) => {
        handlePortMessage(evt.data as IPortMessage, windowType);
    };
});

// 辅助窗口关闭（unmount）
ipcRenderer.on(IPC.UNMOUNT, (_e, data: { windowType: WindowType }) => {
    const { windowType } = data;
    const port = auxiliaryPorts.get(windowType);
    if (port) {
        port.close();
        auxiliaryPorts.delete(windowType);
        auxiliarySubscriptions.delete(windowType);
    }
});

// 接收主进程发来的 Command
ipcRenderer.on(IPC.COMMAND, (_e, message: IPortMessage) => {
    if (message.type === 'command') {
        ee.emit('command', message.payload, 'main-process');
    }
});

// ─── 消息路由 ───

function handlePortMessage(data: IPortMessage, from: WindowType) {
    switch (data.type) {
        case 'ping': {
            // 回复 ping，建立连接
            const port = auxiliaryPorts.get(from);
            port?.postMessage({
                type: 'ping',
                timestamp: Date.now(),
            });
            break;
        }

        case 'subscribeAppState':
            // 记录该辅助窗口关心的状态字段
            auxiliarySubscriptions.set(from, data.payload as AppStateType[]);
            // 通知 renderer 层有新订阅者，让 renderer 从 store 定向推送最新状态
            ee.emit('subscribe', from);
            break;

        case 'command':
            // 转发指令，附带来源标识
            ee.emit('command', data.payload, from);
            break;
    }
}

// ─── 内部工具 ───

/** 按订阅 key 过滤状态并推送给指定端口 */
function postFilteredState(
    port: MessagePort,
    keys: AppStateType[],
    state: Partial<IAppState>,
): void {
    const filtered: Record<string, unknown> = {};
    let count = 0;
    for (const key of keys) {
        if (key in state) {
            filtered[key] = state[key];
            count++;
        }
    }
    if (count > 0) {
        port.postMessage({
            type: 'syncAppState',
            payload: filtered,
            timestamp: Date.now(),
        });
    }
}

// ─── 公开 API ───

/**
 * 同步应用状态到主进程和所有辅助窗口
 */
function syncAppState(state: Partial<IAppState>) {
    // → 主进程（全量推送，由主进程自行按需取用）
    ipcRenderer.send(IPC.SYNC_STATE, state);

    // → 各辅助窗口（按订阅过滤）
    for (const [windowType, port] of auxiliaryPorts) {
        const keys = auxiliarySubscriptions.get(windowType);
        if (!keys?.length) {
            continue;
        }
        postFilteredState(port, keys, state);
    }
}

/**
 * 监听指令
 * @param command 指令名
 * @param cb 回调，from 标识来源（WindowType | "main-process"）
 */
function onCommand(command: string, cb: (data: unknown, from: string) => void): () => void {
    const handler = (payload: { command: string; data: unknown }, from: string) => {
        if (payload.command === command) {
            cb(payload.data, from);
        }
    };
    ee.on('command', handler);
    return () => {
        ee.off('command', handler);
    };
}

/**
 * 发送指令（主窗口内部派发）
 */
function sendCommand(command: string, data?: unknown) {
    ee.emit('command', { command, data }, 'main');
}

// ─── 暴露到渲染进程 ───

/**
 * 定向推送状态到指定辅助窗口（按其订阅 key 过滤）
 */
function syncAppStateTo(windowType: WindowType, state: Partial<IAppState>) {
    const port = auxiliaryPorts.get(windowType);
    const keys = auxiliarySubscriptions.get(windowType);
    if (!port || !keys?.length) {
        return;
    }
    postFilteredState(port, keys, state);
}

/**
 * 监听辅助窗口订阅事件
 * 当辅助窗口发送 subscribeAppState 时触发，回调携带窗口类型
 */
function onSubscribe(cb: (windowType: WindowType) => void): () => void {
    ee.on('subscribe', cb);
    return () => {
        ee.off('subscribe', cb);
    };
}

const mod = {
    syncAppState,
    syncAppStateTo,
    onCommand,
    sendCommand,
    onSubscribe,
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
