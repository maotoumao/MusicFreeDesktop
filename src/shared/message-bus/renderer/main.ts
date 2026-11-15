import { IAppState, ICommand } from "@shared/message-bus/type";

interface IMod {
    syncAppState: (appState: IAppState, to?: "main" | number) => void;
    onCommand: <K extends keyof ICommand>(command: K, cb: (data: ICommand[K], from: "main" | number) => void) => void;
    sendCommand: <K extends keyof ICommand>(command: K, data?: ICommand[K]) => void;
    /** 把一帧音频分析数据回给订阅了频谱的扩展窗口 */
    pushVisualizationFrame: (frame: IVisualization.IAudioFrame) => void;
}

const messageBus = window["@shared/message-bus/main" as any] as unknown as IMod;


export default messageBus;
