import { ICommonTagsResult, IPicture, parseFile } from "music-metadata";
import path from "path";
import { localPluginName } from "./constant";
import CryptoJS from "crypto-js";

function getB64Picture(picture: IPicture) {
    return `data:${picture.format};base64,${picture.data.toString("base64")}`;
  }
  
  export async function parseLocalMusicItem(
    filePath: string
  ): Promise<IMusic.IMusicItem> {
    const hash = CryptoJS.MD5(filePath).toString();
    try {
      const { common = {} as ICommonTagsResult } = await parseFile(filePath);
      return {
        title: common.title ?? path.parse(filePath).name,
        artist: common.artist ?? "未知作者",
        artwork: common.picture?.[0]
          ? getB64Picture(common.picture[0])
          : undefined,
        album: common.album ?? "未知专辑",
        url: addFileScheme(filePath),
        rawPath: filePath,
        platform: localPluginName,
        id: hash,
        rawLrc: common.lyrics?.join(""),
      };
    } catch {
      return {
        title: filePath,
        id: hash,
        platform: localPluginName,
        rawPath: filePath,
        url: addFileScheme(filePath),
        artist: "-",
      };
    }
  }
  
  export function addFileScheme(filePath: string) {
    return filePath.startsWith("file://") ? filePath : `file://${filePath}`;
  }