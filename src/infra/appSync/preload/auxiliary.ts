/**
 * appSync — 辅助窗口 Preload 层
 *
 * 职责:
 *  1. 通过 MessagePort 与主窗口建立连接
 *  2. 接收并缓存应用状态
 *  3. 向主窗口发送指令
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { IAppState, IPortMessage } from '@appTypes/infra/appSync';
import EventEmitter from 'eventemitter3';
import { IPC, CONTEXT_BRIDGE_KEY_AUXILIARY } from '../common/constant';

// ─── 内部状态 ───

let port: MessagePort | null = null;
let connected = false;
let pingTimer: ReturnType<typeof setInterval> | null = null;

/** 连接建立前的消息缓存 */
const cachedMessages: IPortMessage[] = [];

/** 本地状态快照 */
let appState: Partial<IAppState> = {};

const ee = new EventEmitter<{
    stateChanged: [Partial<IAppState>, Partial<IAppState>];
}>();

// ─── 连接管理 ───

ipcRenderer.on(IPC.PORT, (e) => {
    if (!e.ports?.length) {
        return;
    }

    port = e.ports[0];

    // 持续 ping 直到收到主窗口回复
    pingTimer = setInterval(() => {
        port?.postMessage({
            type: 'ping',
            timestamp: Date.now(),
        });
    }, 300);

    port.onmessage = (evt) => {
        const data = evt.data as IPortMessage;

        switch (data.type) {
            case 'ping':
                // 主窗口回复了 ping，连接建立
                connected = true;
                if (pingTimer) {
                    clearInterval(pingTimer);
                    pingTimer = null;
                }
                // 发送缓存的消息
                for (const msg of cachedMessages) {
                    port!.postMessage(msg);
                }
                cachedMessages.length = 0;
                break;

            case 'syncAppState': {
                // 接收状态更新
                const payload = data.payload as Partial<IAppState>;
                appState = { ...appState, ...payload };
                ee.emit('stateChanged', appState, payload);
                break;
            }
        }
    };
});

// ─── 消息发送 ───

function postOrCache(message: IPortMessage) {
    if (!port || !connected) {
        cachedMessages.push(message);
        return;
    }
    port.postMessage(message);
}

// ─── 公开 API ───

/** 向主窗口发送指令 */
function sendCommand(command: string, data?: unknown) {
    postOrCache({
        type: 'command',
        payload: { command, data },
        timestamp: Date.now(),
    });
}

/** 订阅应用状态的特定字段 */
function subscribeAppState(keys: string[]) {
    postOrCache({
        type: 'subscribeAppState',
        payload: keys,
        timestamp: Date.now(),
    });
}

/** 获取当前状态快照 */
function getAppState(): Partial<IAppState> {
    return appState;
}

/** 监听状态变化 */
function onStateChange(
    cb: (state: Partial<IAppState>, changed: Partial<IAppState>) => void,
): () => void {
    ee.on('stateChanged', cb);
    return () => {
        ee.off('stateChanged', cb);
    };
}

// ─── 暴露到渲染进程 ───

const mod = {
    sendCommand,
    subscribeAppState,
    getAppState,
    onStateChange,
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY_AUXILIARY, mod);
