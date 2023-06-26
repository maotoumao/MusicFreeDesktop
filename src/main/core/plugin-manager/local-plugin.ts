import { localPluginHash, localPluginName } from "@/common/constant";
import { Plugin } from "./plugin";
import { addFileScheme, parseLocalMusicItem } from "@/common/file-util";


function localPluginDefine(): IPlugin.IPluginInstance {
  return {
    platform: localPluginName,
    _path: "",
    async getMediaSource(musicItem) {
      return {
        url: addFileScheme(musicItem.url),
      };
    },
    async getLyric(musicItem) {
      return {
        rawLrc: musicItem.rawLrc,
      };
    },
    async importMusicItem(filePath) {
      return parseLocalMusicItem(filePath);
    },
  };
}

const localPlugin = new Plugin(localPluginDefine, "");
localPlugin.hash = localPluginHash;
export default localPlugin;
