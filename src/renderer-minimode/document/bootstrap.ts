import { setupRendererAppConfig } from "@/shared/app-config/renderer";
import { setupI18n } from "@/shared/i18n/renderer";
import { setupPlayerStateSync } from "@/shared/player-command-sync/renderer";

export default async function () {
  // let prevTimestamp = 0;
  // TODO: broadcast
  await setupRendererAppConfig();
  await setupI18n();

  setupPlayerStateSync();
}
