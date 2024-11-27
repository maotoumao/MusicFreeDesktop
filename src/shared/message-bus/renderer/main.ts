import {IAppState, ICommand} from "@shared/message-bus/type";

interface IMod {
    syncAppState: (appState: IAppState, to?: "main" | number) => void;
    onCommand: <K extends keyof ICommand>(command: K, cb: (data: ICommand[K], from: "main" | number) => void) => void;
}

const messageBus = window["@shared/message-bus/main" as any] as unknown as IMod;


export default messageBus;
