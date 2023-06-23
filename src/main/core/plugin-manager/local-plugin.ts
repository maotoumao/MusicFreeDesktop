import { localPluginHash, localPluginName } from "@/common/constant";
import { Plugin } from "./plugin";
import { ICommonTagsResult, IPicture, parseFile } from "music-metadata";
import CryptoJS from "crypto-js";
import fs from 'fs/promises';
import path from 'path';

function getB64Picture(picture: IPicture) {
  return `data:${picture.format};base64,${picture.data.toString("base64")}`;
}

function addFileScheme(filePath: string) {
  return filePath.startsWith("file://") ? filePath : `file://${filePath}`;
}

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
      const hash = CryptoJS.MD5(filePath).toString();
      try {
        const { common = {} as ICommonTagsResult } = await parseFile(filePath);
        return {
          title: common.title ?? path.parse(filePath).name,
          artist: common.artist ?? '未知作者',
          artwork: common.picture?.[0]
            ? getB64Picture(common.picture[0])
            : undefined,
          album: common.album ?? '未知专辑',
          url: addFileScheme(filePath),
          platform: localPluginName,
          id: hash,
          rawLrc: common.lyrics?.join(""),
        };
      } catch {
        return {
          title: filePath,
          id: hash,
          platform: localPluginName,
          url: addFileScheme(filePath),
          artist: "-",
        };
      }
    },
  };
}

const localPlugin = new Plugin(localPluginDefine, "");
localPlugin.hash = localPluginHash;
export default localPlugin;
