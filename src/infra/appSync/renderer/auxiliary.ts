/**
 * appSync — 辅助窗口 Renderer 层
 *
 * 提供类型安全的 API 和 React Hooks。
 */
import type { IAppState, ICommand } from '@appTypes/infra/appSync';
import { useEffect, useState } from 'react';
import { CONTEXT_BRIDGE_KEY_AUXILIARY } from '../common/constant';

interface IMod {
    sendCommand(command: string, data?: unknown): void;
    subscribeAppState(keys: string[]): void;
    getAppState(): Partial<IAppState>;
    onStateChange(cb: (state: Partial<IAppState>, changed: Partial<IAppState>) => void): () => void;
}

const mod = window[CONTEXT_BRIDGE_KEY_AUXILIARY as any] as unknown as IMod;

// ─── React Hooks ───

/** 订阅全部应用状态 */
export function useAppState(): Partial<IAppState> {
    const [state, setState] = useState<Partial<IAppState>>(mod.getAppState);

    useEffect(() => {
        const handler = (appState: Partial<IAppState>) => {
            setState(appState);
        };
        const dispose = mod.onStateChange(handler);
        setState(mod.getAppState());
        return dispose;
    }, []);

    return state;
}

/** 订阅单个状态字段 */
export function useAppStatePartial<K extends keyof IAppState>(key: K): IAppState[K] | undefined {
    const [value, setValue] = useState<IAppState[K] | undefined>(
        mod.getAppState()?.[key] as IAppState[K] | undefined,
    );

    useEffect(() => {
        const handler = (_state: Partial<IAppState>, changed: Partial<IAppState>) => {
            if (key in changed) {
                setValue(mod.getAppState()[key] as IAppState[K] | undefined);
            }
        };
        const dispose = mod.onStateChange(handler);
        setValue(mod.getAppState()?.[key] as IAppState[K] | undefined);
        return dispose;
    }, [key]);

    return value;
}

// ─── API ───

const appSyncAuxiliary = {
    /** 向主窗口发送指令 */
    sendCommand<K extends keyof ICommand>(command: K, data?: ICommand[K]): void {
        mod.sendCommand(command as string, data);
    },

    /** 订阅应用状态的特定字段 */
    subscribeAppState(keys: (keyof IAppState)[]): void {
        mod.subscribeAppState(keys as string[]);
    },

    /** 获取当前状态快照 */
    getAppState(): Partial<IAppState> {
        return mod.getAppState();
    },

    /** 监听状态变化，返回取消监听函数 */
    onStateChange(
        cb: (state: Partial<IAppState>, changed: Partial<IAppState>) => void,
    ): () => void {
        return mod.onStateChange(cb);
    },
};

export default appSyncAuxiliary;
