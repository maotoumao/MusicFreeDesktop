import { setupI18n } from "@/shared/i18n/renderer";
import { setupPlayerStateSync } from "@/shared/player-command-sync/renderer";
import AppConfig from "@shared/app-config/renderer";

export default async function () {
  // let prevTimestamp = 0;
  // TODO: broadcast
  await AppConfig.setup();
  await setupI18n();

  setupPlayerStateSync();
}
