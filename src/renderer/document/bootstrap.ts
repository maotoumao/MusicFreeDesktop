import MusicSheet from "../core/music-sheet";
import { registerPluginEvents } from "../core/plugin-delegate";

export default function(){
    registerPluginEvents();
    MusicSheet.initSheets();
}