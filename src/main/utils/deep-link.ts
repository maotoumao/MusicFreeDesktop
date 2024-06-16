import { supportLocalMediaType } from "@/common/constant";
import { parseLocalMusicItem, safeStat } from "@/common/file-util";
import { sendToMainWindow } from "@/shared/message-hub/main";
import { dialog } from "electron";
import fs from "fs/promises";
import { installPluginFromUrl, sendPlugins } from "../core/plugin-manager";

export function handleDeepLink(url: string) {
  if (!url) {
    return;
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === "musicfree:") {
      handleMusicFreeScheme(urlObj);
    }
  } catch {}
}

async function handleMusicFreeScheme(url: URL) {
  const hostname = url.hostname;
  if (hostname === "install") {
    try {
      const pluginUrlStr =
        url.pathname.slice(1) || url.searchParams.get("plugin");
      const pluginUrls = pluginUrlStr.split(",").map(decodeURIComponent);
      await Promise.all(
        pluginUrls.map((it) => installPluginFromUrl(it).catch(() => {}))
      );

      sendPlugins();
    } catch {}
  }
}

async function handleBareUrl(url: string) {
  try {
    if (
      (await safeStat(url)).isFile() &&
      supportLocalMediaType.some((postfix) => url.endsWith(postfix))
    ) {
      const musicItem = await parseLocalMusicItem(url);
      sendToMainWindow({
        cmd: "PlayMusic",
        data: musicItem,
      });
    }
  } catch {}
}
