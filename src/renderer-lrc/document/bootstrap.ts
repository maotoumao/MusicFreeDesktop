import { setupRendererAppConfig } from "@/shared/app-config/renderer";
import { setupPlayerStateSync } from "@/shared/player-command-sync/renderer";

export default async function () {
  // let prevTimestamp = 0;
  await setupRendererAppConfig();

  setupPlayerStateSync();
}
