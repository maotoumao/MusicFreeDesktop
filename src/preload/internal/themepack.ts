import { IThemePack } from "@/common/app-config/type";
import { addFileScheme, addTailSlash } from "@/common/file-util";
import path from "path";
import fs from "fs/promises";
import rendererAppConfig from "@/common/app-config/renderer";
import { ipcRenderer } from "electron";

const themeNodeId = `themepack-node`;

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

async function selectTheme(themePack: IThemePack | null) {
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
    }
    ipcRenderer.invoke("set-app-config-path", {
      keyPath: "theme.currentThemePack",
      value: themePack,
    });
  } catch {}
}

function replaceAlias(
  rawText: string,
  basePath: string,
  fileScheme = true
) {
  return rawText.replaceAll(
    "@/",
    addTailSlash(fileScheme ? addFileScheme(basePath) : basePath)
  );
}

export default { selectTheme };
