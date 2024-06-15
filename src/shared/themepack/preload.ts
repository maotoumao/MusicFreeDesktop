import { addFileScheme, addTailSlash } from "@/common/file-util";
import path from "path";
import fs from "fs/promises";
import { Readable } from "stream";
import { rimraf } from "rimraf";
import Store from "@/common/store";
import { nanoid } from "nanoid";
import { createReadStream, createWriteStream } from "original-fs";
import unzipper from "unzipper";
import { getGlobalContext } from "../global-context/preload";
import { contextBridge } from "electron";
import CryptoJS from "crypto-js";

const themeNodeId = "themepack-node";
const themePathKey = "themepack-path";

const validIframeMap = new Map<
  "app" | "header" | "body" | "music-bar" | "side-bar" | "page",
  HTMLIFrameElement | null
>([
  ["app", null],
  ["header", null],
  ["body", null],
  ["music-bar", null],
  ["side-bar", null],
  ["page", null],
]);

const themePackBasePath: string = path.resolve(
  getGlobalContext().appPath.userData,
  "./musicfree-themepacks"
);

/**
 * TODO: iframe需要运行在独立的进程中，不然会影响到app的fps 得想个办法
 */

/** 选择某个主题 */
async function selectTheme(themePack: ICommon.IThemePack | null) {
  const themeNode = document.querySelector(`#${themeNodeId}`);
  if (themePack === null) {
    // 移除
    themeNode.innerHTML = "";
    validIframeMap.forEach((value, key) => {
      if (value !== null) {
        value.remove();
        validIframeMap.set(key, null);
      }
    });
    localStorage.removeItem(themePathKey);
  } else {
    const rawStyle = await fs.readFile(
      path.resolve(themePack.path, "index.css"),
      "utf-8"
    );
    themeNode.innerHTML = replaceAlias(rawStyle, themePack.path);

    if (themePack.iframe) {
      validIframeMap.forEach(async (value, key) => {
        const themePackIframeSource = themePack.iframe[key];
        if (themePackIframeSource) {
          // 如果有，且当前也有
          let iframeNode = null;
          if (value !== null) {
            // 移除旧的
            value.remove();
            validIframeMap.set(key, null);
          }
          // 新的iframe
          iframeNode = document.createElement("iframe");
          iframeNode.scrolling = "no";
          document.querySelector(`.${key}-container`)?.prepend?.(iframeNode);
          validIframeMap.set(key, iframeNode);

          if (themePackIframeSource.startsWith("http")) {
            iframeNode.src = themePackIframeSource;
          } else {
            const rawHtml = await fs.readFile(
              replaceAlias(themePackIframeSource, themePack.path, false),
              "utf-8"
            );
            iframeNode.contentWindow.document.open();
            iframeNode.contentWindow.document.write(
              replaceAlias(rawHtml, themePack.path)
            );
            iframeNode.contentWindow.document.close();
          }
        } else if (value) {
          value.remove();
          validIframeMap.set(key, null);
        }
      });
    } else {
      validIframeMap.forEach((value, key) => {
        if (value !== null) {
          value.remove();
          validIframeMap.set(key, null);
        }
      });
    }
    localStorage.setItem(themePathKey, themePack.path);
  }
}

/** 替换标记 */
function replaceAlias(
  rawText: string,
  basePath: string,
  withFileScheme = true
) {
  return rawText.replaceAll(
    "@/",
    addTailSlash(withFileScheme ? addFileScheme(basePath) : basePath)
  );
}

async function checkPath() {
  // 路径:
  try {
    const res = await fs.stat(themePackBasePath);
    if (!res.isDirectory()) {
      await rimraf(themePackBasePath);
      throw new Error();
    }
  } catch {
    fs.mkdir(themePackBasePath, {
      recursive: true,
    });
  }
}

const downloadResponse = async (response: Response, filePath: string) => {
  const reader = response.body.getReader();
  let size = 0;

  return new Promise<void>((resolve, reject) => {
    const rs = new Readable();

    rs._read = async () => {
      const result = await reader.read();
      if (!result.done) {
        rs.push(Buffer.from(result.value));
        size += result.value.byteLength;
      } else {
        rs.push(null);
        return;
      }
    };
    rs.on("error", reject);

    const stm = rs.pipe(createWriteStream(filePath));

    stm.on("finish", resolve);
    stm.on("close", resolve);
    stm.on("error", reject);
  });
};

async function parseThemePack(
  themePackPath: string
): Promise<ICommon.IThemePack | null> {
  try {
    if (!themePackPath) {
      return null;
    }
    const packContent = await fs.readdir(themePackPath);
    if (
      !(
        packContent.includes("config.json") && packContent.includes("index.css")
      )
    ) {
      throw new Error("Not Valid Theme Pack");
    }

    const rawConfig = await fs.readFile(
      path.resolve(themePackPath, "config.json"),
      "utf-8"
    );
    // 读取json
    const jsonData = JSON.parse(rawConfig);

    const themePack: ICommon.IThemePack = {
      ...jsonData,
      hash: CryptoJS.MD5(rawConfig).toString(CryptoJS.enc.Hex),
      preview: jsonData.preview?.startsWith?.("#")
        ? jsonData.preview
        : jsonData.preview?.replace?.(
            "@/",
            addTailSlash(addFileScheme(themePackPath))
          ),
      path: themePackPath,
    };
    return themePack;
  } catch (e) {
    console.warn(e);
    return null;
  }
}

/** 加载所有的主题包 */
async function initCurrentTheme() {
  try {
    await checkPath();
    const currentThemePath = localStorage.getItem(themePathKey);

    console.log(currentThemePath, themePathKey);

    const currentTheme: ICommon.IThemePack | null = await parseThemePack(
      currentThemePath
    );
    return currentTheme;
  } catch (e) {
    return null;
  }
}

async function loadThemePacks() {
  const themePackDirNames = await fs.readdir(themePackBasePath);
  // 读取所有的文件夹
  const parsedThemePacks: ICommon.IThemePack[] = [];

  for (const themePackDir of themePackDirNames) {
    try {
      const parsedThemePack = await parseThemePack(
        path.resolve(themePackBasePath, themePackDir)
      );
      if (parsedThemePack) {
        parsedThemePacks.push(parsedThemePack);
      }
    } catch {}
  }
  return parsedThemePacks;
}

async function installRemoteThemePack(remoteUrl: string) {
  const cacheFilePath = path.resolve(
    getGlobalContext().appPath.temp,
    `./${nanoid()}.mftheme`
  );
  try {
    const resp = await fetch(remoteUrl);
    await downloadResponse(resp, cacheFilePath);
    const config = await installThemePack(cacheFilePath);
    if (!config) {
      throw new Error("Download fail");
    }
    return config;
  } catch (e: any) {
    throw e;
  } finally {
    await rimraf(cacheFilePath);
  }
}

async function installThemePack(themePackPath: string) {
  // 第一步: 移动到安装文件夹
  try {
    const cacheFolder = path.resolve(themePackBasePath, nanoid(12));
    await createReadStream(themePackPath)
      .pipe(
        unzipper.Extract({
          path: cacheFolder,
        })
      )
      .promise();
    const parsedThemePack = await parseThemePack(cacheFolder);

    if (parsedThemePack) {
      parsedThemePack.path = cacheFolder;
      return parsedThemePack;
    } else {
      // 无效的主题包
      await rimraf(cacheFolder);
      return null;
    }
  } catch (e) {
    return null;
  }
}

async function uninstallThemePack(themePack: ICommon.IThemePack) {
  return await rimraf(themePack.path);
}

export const mod = {
  selectTheme,
  initCurrentTheme,
  loadThemePacks,
  installThemePack,
  uninstallThemePack,
  installRemoteThemePack,
  replaceAlias,
};

contextBridge.exposeInMainWorld("@shared/themepack", mod);
