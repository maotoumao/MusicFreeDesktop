import { ICommonTagsResult, IPicture, parseFile } from "music-metadata";
import path from "path";
import { localPluginName, supportLocalMediaType } from "./constant";
import CryptoJS from "crypto-js";
import fs from "fs/promises";
import url from 'url';

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
      localPath: filePath,
      platform: localPluginName,
      id: hash,
      rawLrc: common.lyrics?.join(""),
    };
  } catch {
    return {
      title: filePath,
      id: hash,
      platform: localPluginName,
      localPath: filePath,
      url: addFileScheme(filePath),
      artist: "-",
    };
  }
}

export async function parseLocalMusicItemFolder(
  folderPath: string
): Promise<IMusic.IMusicItem[]> {
  /**
   * 1. 筛选出符合条件的
   */

  try {
    const folderStat = await fs.stat(folderPath);
    if (folderStat.isDirectory()) {
      const files = await fs.readdir(folderPath);
      const validFiles = files.filter((fp) =>
        supportLocalMediaType.some((postfix) => fp.endsWith(postfix))
      );
      // TODO: 分片
      return Promise.all(validFiles.map((fp) => parseLocalMusicItem(path.resolve(folderPath, fp))));
    }
    throw new Error("Folder Not Found");
  } catch {
    return [];
  }
}

export function addFileScheme(filePath: string) {
  return url.pathToFileURL(filePath).toString();
}

export function addTailSlash(filePath: string) {
  return (filePath.endsWith('/') || filePath.endsWith('\\')) ? filePath : filePath + '/';
}
