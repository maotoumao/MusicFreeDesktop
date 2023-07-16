import { IThemePack } from "@/common/app-config/type";
import { addFileScheme, addTailSlash } from "@/common/file-util";
import path from "path";
import fs from "fs/promises";
import rendererAppConfig from "@/common/app-config/renderer";
import { ipcRenderer } from "electron";

const themeNodeId = `themepack-node`;

async function selectTheme(themePack: IThemePack | null) {
  try {
    const themeNode = document.querySelector(`#${themeNodeId}`);
    if (themePack === null) {
      // 移除
      themeNode.innerHTML = "";
    } else {
      const rawStyle = await fs.readFile(
        path.resolve(themePack.path, "index.css"),
        "utf-8"
      );      
      themeNode.innerHTML = rawStyle.replaceAll("@/", addTailSlash(addFileScheme(themePack.path)));
    }
    ipcRenderer.invoke("set-app-config-path", {
      keyPath: "theme.currentThemePack",
      value: themePack,
    });
  } catch {}
}

export default { selectTheme };
