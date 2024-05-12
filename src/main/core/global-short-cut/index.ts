import { getAppConfigPath, setAppConfigPath } from "@/shared/app-config/main";
import { IAppConfig } from "@/shared/app-config/type";
import { shortCutKeys, shortCutKeysEvts } from "@/common/constant";
import { ipcMainOn, ipcMainSendMainWindow } from "@/shared/ipc/main";
import { globalShortcut } from "electron";

type IShortCutKeys = keyof IAppConfig["shortCut"]["shortcuts"];

export async function setupGlobalShortCut() {
  await registerGlobalShortCut();

  ipcMainOn("enable-global-short-cut", async (enabled: boolean) => {
    if (enabled) {
      await registerGlobalShortCut();
    } else {
      globalShortcut.unregisterAll();
    }
    setAppConfigPath("shortCut.enableGlobal", enabled);
  });

  ipcMainOn("bind-global-short-cut", async (prop) => {
    await registerSingleShortCut(prop.key, prop.shortCut);
  });

  ipcMainOn("unbind-global-short-cut", async (prop) => {
    await unregisterShortCut(prop.key, prop.shortCut);
  });
}

async function registerGlobalShortCut() {
  for (const shortCutKey of shortCutKeys) {
    const globalShortCutConfig = await getAppConfigPath(
      `shortCut.shortcuts.${shortCutKey}.global`
    );
    if (globalShortCutConfig?.length) {
      await registerSingleShortCut(shortCutKey, globalShortCutConfig);
    }
  }
}

async function registerSingleShortCut(key: IShortCutKeys, shortCut: string[]) {
  try {
    if (shortCut.length) {
      const reg = globalShortcut.register(shortCut.join("+"), () => {
        ipcMainSendMainWindow("navigate", `evt://${shortCutKeysEvts[key]}`);
      });
      await setAppConfigPath(
        `shortCut.shortcuts.${key}.global`,
        reg ? shortCut : undefined
      );
    }
  } catch {}
}

async function unregisterShortCut(key: IShortCutKeys, shortCut: string[]) {
  if (shortCut?.length) {
    globalShortcut.unregister(shortCut.join("+"));
    await setAppConfigPath(`shortCut.shortcuts.${key}.global`, undefined);
  }
}
