import { setupPlayerStateSync } from "@/shared/player-command-sync/renderer";
import AppConfig from "@shared/app-config.new/renderer";

export default async function () {
  // let prevTimestamp = 0;
  await AppConfig.setup()

  setupPlayerStateSync();
}
