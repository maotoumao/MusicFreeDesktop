import AppConfig from "@shared/app-config/renderer";
import messageBus from "@shared/message-bus/renderer/extension";

export default async function () {
    // let prevTimestamp = 0;
    await AppConfig.setup();
    messageBus.subscribeAppState(["playerState", "musicItem", "repeatMode", "parsedLrc", "lyricText", "fullLyric", "progress"]);
    messageBus.sendCommand("SyncAppState");
}
