import MusicSheet from "../core/music-sheet";
import { registerPluginEvents } from "../core/plugin-delegate";
import trackPlayer from "../core/track-player";

export default async function () {
  await Promise.all([
    registerPluginEvents(),
    MusicSheet.initSheets(),
    trackPlayer.setupPlayer(),
  ]);
}
