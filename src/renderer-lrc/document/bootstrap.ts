import { setupPlayerStateSync } from "@/shared/player-command-sync/renderer";
import AppConfig from "@shared/app-config/renderer";

export default async function () {
  // let prevTimestamp = 0;
  await AppConfig.setup()

  setupPlayerStateSync();
}
