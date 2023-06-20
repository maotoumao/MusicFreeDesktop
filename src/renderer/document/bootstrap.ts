import MusicSheet from "../core/music-sheet";
import { registerPluginEvents } from "../core/plugin-delegate";
import trackPlayer from "../core/track-player";

export default function(){
    registerPluginEvents();
    MusicSheet.initSheets();
    trackPlayer.setupPlayer();
}