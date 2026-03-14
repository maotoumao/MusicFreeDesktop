/**
 * AppSync - 跨进程应用状态同步与指令派发
 *
 * 数据流向:
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │             Main Window Renderer                  │
 *   │          (AppState source of truth)               │
 *   └──────┬────────────────────────────┬──────────────┘
 *          │ syncAppState               │ syncAppState
 *          │ ipcRenderer.send           │ MessagePort (按订阅过滤)
 *          ▼                            ▼
 *    Main Process                 Auxiliary Windows
 *    (部分副本)                    (lyric, minimode)
 *
 * Command 流向:
 *   Any window / Main Process  ──→  Main Window Renderer
 */

import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
import type { PlayerState, RepeatMode } from '@common/constant';
import type { IParsedLrcItem } from '@common/lyricParser';

/**
 * 跨进程同步的应用状态。
 *
 * 所有需要跨窗口同步的状态直接在此接口声明，不使用 declaration merging。
 */
export interface IAppState {
    // ─── TrackPlayer ───
    musicItem: IMusicItemSlim | null;
    playerState: PlayerState;
    repeatMode: RepeatMode;
    currentLrc: IParsedLrcItem | null;
    progress: { currentTime: number; duration: number };
    isFavorite: boolean;
}

export type AppStateType = keyof IAppState;

/**
 * 跨进程指令定义。
 * Key = 指令名（kebab-case）, Value = 指令参数类型。
 *
 * 通过 declaration merging 扩展此接口来添加指令：
 * @example
 * ```ts
 * declare module "@appTypes/infra/appSync" {
 *     interface ICommand {
 *         'toggle-player-state': void;
 *         'play-music': IMusic.IMusicItem;
 *     }
 * }
 * ```
 */
export interface ICommand {
    // ─── ShortCut Actions ───
    'play/pause': void;
    'skip-previous': void;
    'skip-next': void;
    'toggle-desktop-lyric': void;
    'volume-up': void;
    'volume-down': void;
    'like/dislike': void;
    'toggle-minimode': void;

    // ─── Tray Actions ───
    'set-repeat-mode': RepeatMode;
    navigate: string;
    'open-music-detail': void;
}

// ─── MessagePort 内部协议类型 ───

export interface IPortMessageMap {
    /** 连接探测 */
    ping: undefined;
    /** 指令 */
    command: {
        command: string;
        data: unknown;
    };
    /** 辅助窗口订阅状态字段 */
    subscribeAppState: string[];
    /** 主窗口 → 辅助窗口的状态推送 */
    syncAppState: Partial<IAppState>;
}

export type PortMessageType = keyof IPortMessageMap;

export interface IPortMessage<T extends PortMessageType = PortMessageType> {
    type: T;
    payload: IPortMessageMap[T];
    timestamp: number;
}

// ─── 共享能力接口 ───

/**
 * 指令发送能力接口。
 *
 * 用于其他 infra 模块通过 setup 注入来发送指令，
 * 而无需直接 import appSync 单例。
 */
export interface ICommandSender {
    sendCommand<K extends keyof ICommand>(command: K, data?: ICommand[K]): void;
}
