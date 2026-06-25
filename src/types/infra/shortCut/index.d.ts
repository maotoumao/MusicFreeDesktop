/**
 * ShortCut — 快捷键模块类型定义
 *
 * 管理应用内（local）和系统级（global）键盘快捷键的注册与派发。
 * 快捷键触发时通过 appSync 的 ICommand 机制派发指令到主窗口。
 */

// ─── 核心类型 ───

/**
 * 所有可绑定快捷键的动作名称。
 * 每个动作必须同时在 ICommand 中注册（通过 declaration merging）。
 */
export type ShortCutAction =
    | 'play/pause'
    | 'skip-previous'
    | 'skip-next'
    | 'toggle-desktop-lyric'
    | 'volume-up'
    | 'volume-down'
    | 'like/dislike'
    | 'toggle-minimode';

/**
 * 单个动作的快捷键绑定配置。
 * 快捷键格式遵循 Electron Accelerator 规范。
 *
 * `string[]` 表示一个组合键的各个按键部分，如 `["CmdOrCtrl", "Shift", "P"]`。
 * 使用时通过 `join('+')` 拼接为完整的 Accelerator 字符串。
 *
 * @see https://www.electronjs.org/docs/latest/api/accelerator
 */
export interface IShortCutBinding {
    /** 应用内快捷键的按键部分，如 ["CmdOrCtrl", "Shift", "P"] */
    local?: string[] | null;
    /** 全局快捷键的按键部分，如 ["CmdOrCtrl", "Shift", "P"] */
    global?: string[] | null;
}

/** 完整的快捷键映射表 */
export type IShortCutMap = Record<ShortCutAction, IShortCutBinding>;

// ─── 全局快捷键状态 ───

/** 单个全局快捷键的注册结果 */
export interface IGlobalShortCutRegistration {
    action: ShortCutAction;
    accelerator: string;
    /** 是否注册成功（false 通常意味着被其他应用占用） */
    registered: boolean;
}
