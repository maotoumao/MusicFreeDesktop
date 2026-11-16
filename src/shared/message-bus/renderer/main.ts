import { IAppState, ICommand } from "@shared/message-bus/type";

interface IMod {
    syncAppState: (appState: IAppState, to?: "main" | number) => void;
    onCommand: <K extends keyof ICommand>(command: K, cb: (data: ICommand[K], from: "main" | number) => void) => void;
    sendCommand: <K extends keyof ICommand>(command: K, data?: ICommand[K]) => void;
    /** 把一帧音频分析数据回给订阅了频谱的扩展窗口（to 指定只回给某窗口） */
    pushVisualizationFrame: (frame: IVisualization.IAudioFrame, to?: number) => void;
    /**
     * 注册取帧回调——preload 收到取帧请求时调用它。
     * renderer 不能 import electron，主世界与 preload 只能靠 contextBridge 传函数。
     */
    setFrameProvider: (provider: (from: number) => void) => void;
}

const messageBus = window["@shared/message-bus/main" as any] as unknown as IMod;


export default messageBus;
