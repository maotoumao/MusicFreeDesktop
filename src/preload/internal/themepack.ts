import { addFileScheme, addTailSlash } from "@/common/file-util";
import path from "path";
import fs from "fs/promises";
import { ipcRenderer } from "electron";
import { rimraf } from "rimraf";
import Store from "@/common/store";
import { nanoid } from "nanoid";

const themeNodeId = `themepack-node`;
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

const allThemePacksStore = new Store<Array<ICommon.IThemePack | null>>([]);
const currentThemePackStore = new Store<ICommon.IThemePack | null>(null);

/** 选择某个主题 */
async function selectTheme(themePack: ICommon.IThemePack | null) {
  try {
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
      }
      localStorage.setItem(themePathKey, themePack.path);
    }
    currentThemePackStore.setValue(themePack);
  } catch {}
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

async function appGetPath(pathName: string) {
  return ipcRenderer.invoke("app-get-path", pathName);
}

let themePackBasePath: string;

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

/** 加载所有的主题包 */
async function setupThemePacks() {
  themePackBasePath = path.resolve(
    await appGetPath("userData"),
    "./musicfree-themepacks"
  );
  await checkPath();
  const allThemePacks = await loadThemePacks();
  const currentThemePath = localStorage.getItem(themePathKey);
  const currentTheme: ICommon.IThemePack | null = null;
  if (currentThemePath) {
    const currentTheme = allThemePacks.find(
      (item) => item.path === currentThemePath
    );
    if (!currentTheme) {
      localStorage.removeItem(themePathKey);
    }
  }
  allThemePacksStore.setValue(allThemePacks);
  selectTheme(currentTheme ?? null);
}

async function loadThemePacks() {
  const themePackDirNames = await fs.readdir(themePackBasePath);
  // 读取所有的文件夹
  const parsedThemePacks: ICommon.IThemePack[] = [];

  for (const themePackDir of themePackDirNames) {
    const parsedThemePack = await parseThemePack(
      path.resolve(themePackBasePath, themePackDir)
    );
    if (parseThemePack) {
      parsedThemePacks.push(parsedThemePack);
    }
  }

  return parsedThemePacks;
}

async function parseThemePack(
  themePackPath: string
): Promise<ICommon.IThemePack | null> {
  try {
    const packContent = await fs.readdir(themePackPath);
    if (
      !(
        packContent.includes("config.json") && packContent.includes("index.css")
      )
    ) {
      throw new Error("Not Valid Theme Pack");
    }

    // 读取json
    const jsonData = JSON.parse(
      await fs.readFile(path.resolve(themePackPath, "config.json"), "utf-8")
    );
    const themePack: ICommon.IThemePack = {
      ...jsonData,
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
    console.log("eeee", e);
    return null;
  }
}

async function installThemePack(themePackPath: string) {
  const parsedThemePack = await parseThemePack(themePackPath);

  const folderName = `theme-${nanoid()}`;
  const targetFolderName = path.resolve(themePackBasePath, folderName);

  if (parsedThemePack) {
    try {
      await fs.cp(themePackPath, targetFolderName, {
        recursive: true,
      });
      parsedThemePack.path = targetFolderName;
      allThemePacksStore.setValue((prev) => [...prev, parsedThemePack]);
      return [true, null];
    } catch (e) {
      return [false, e];
    }
  }
  return [false, new Error("解析失败")]
}

async function uninstallThemePack(themePack: ICommon.IThemePack) {
  try {
    await rimraf(themePack.path);
    allThemePacksStore.setValue((prev) =>
      prev.filter((item) => item.path !== themePack.path)
    );
    if (currentThemePackStore.getValue()?.path === themePack.path) {
      selectTheme(null);
    }
    return [true, null];
  } catch (e) {
    console.log(e);
    return [false, e];
  }
}

export default {
  selectTheme,
  setupThemePacks,
  allThemePacksStore,
  currentThemePackStore,
  installThemePack,
  uninstallThemePack,
};
