import {IAppState, ICommand} from "@shared/message-bus/type";
import {useEffect, useState} from "react";

interface IMod {
    sendCommand: <K extends keyof ICommand>(command: K, data?: ICommand[K]) => void;
    getAppState: () => IAppState;
    subscribeAppState: (keys: (keyof IAppState)[]) => void;
    onStateChange: (cb: (appState: IAppState, changedAppState: IAppState) => void) => void;
    offStateChange: (cb: (appState: IAppState, changedAppState: IAppState) => void) => void;
}

const mod = window["@shared/message-bus/extension" as any] as unknown as IMod;


export function useAppState() {
    const [appState, setAppState] = useState(mod.getAppState);

    useEffect(() => {
        mod.onStateChange(setAppState);
        return () => {
            mod.offStateChange(setAppState);
        }
    }, []);

    return appState;
}

export function useAppStatePartial<K extends keyof IAppState>(key: K) {
    const [appState, setAppState] = useState<IAppState[K]>(mod.getAppState()?.[key]);
    useEffect(() => {
        const cb = (appState: IAppState, changedAppState: IAppState) => {
            if (key in changedAppState) {
                setAppState(mod.getAppState()[key]);
            }
        }

        mod.onStateChange(cb);
        return () => {
            mod.offStateChange(cb);
        }
    }, []);

    return appState;
}

const messageBus = {
    sendCommand: mod.sendCommand,
    subscribeAppState: mod.subscribeAppState,
    onStateChange: mod.onStateChange,
    offStateChange: mod.offStateChange,
}

export default messageBus;

