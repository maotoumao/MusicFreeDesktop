import { setupI18n } from "@/shared/i18n/renderer";
import AppConfig from "@/providers/app-config/renderer";
import messageBus from "@shared/message-bus/renderer/extension";

export default async function () {
  // TODO: broadcast
  await AppConfig.setup();
  await setupI18n();
  messageBus.subscribeAppState(["playerState", "musicItem", "repeatMode", "parsedLrc", "lyricText"]);
  messageBus.sendCommand("SyncAppState");
}
