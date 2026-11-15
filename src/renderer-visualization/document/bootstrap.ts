import AppConfig from "@shared/app-config/renderer";
import messageBus from "@shared/message-bus/renderer/extension";

export default async function () {
    await AppConfig.setup();
    // subscribeAppState 是**整体替换**订阅键集合，
    // themeColors 与 musicItem 必须在同一次调用里一起订阅。
    messageBus.subscribeAppState([
        "playerState",
        "musicItem",
        "themeColors",
    ]);
    messageBus.sendCommand("SyncAppState");
    // 登记订阅频谱帧——之后才会收到 visualizationFrame 消息
    messageBus.sendCommand("SubscribeVisualization");
}
