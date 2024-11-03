import {shortCutKeys, shortCutKeysEvts} from "@/common/constant";
import {ipcMainOn, ipcMainSendMainWindow} from "@/shared/ipc/main";
import {globalShortcut} from "electron";
import AppConfig from "@shared/app-config.new/main";
import {IAppConfig} from "@/types/app-config";

type IShortCutKeys = keyof IAppConfig["shortCut.shortcuts"];

export async function setupGlobalShortCut() {
    await registerGlobalShortCut();

    ipcMainOn("enable-global-short-cut", async (enabled: boolean) => {
        if (enabled) {
            await registerGlobalShortCut();
        } else {
            globalShortcut.unregisterAll();
        }
        AppConfig.setConfig({
            "shortCut.enableGlobal": enabled
        });
    });

    ipcMainOn("bind-global-short-cut", async (prop) => {
        await registerSingleShortCut(prop.key, prop.shortCut);
    });

    ipcMainOn("unbind-global-short-cut", async (prop) => {
        await unregisterShortCut(prop.key, prop.shortCut);
    });
}

async function registerGlobalShortCut() {
    const globalShortCuts = AppConfig.getConfig("shortCut.shortcuts");
    for (const shortCutKey of shortCutKeys) {

        const globalShortCutConfig = globalShortCuts[shortCutKey]?.global;

        if (globalShortCutConfig?.length) {
            await registerSingleShortCut(shortCutKey, globalShortCutConfig);
        }
    }
}

async function registerSingleShortCut(key: IShortCutKeys, shortCut: string[]) {
    try {
        if (shortCut.length) {
            const prevConfig = AppConfig.getConfig("shortCut.shortcuts");

            if (prevConfig[key].global?.length) {
                globalShortcut.unregister(prevConfig[key].global.join("+"));
            }

            const reg = globalShortcut.register(shortCut.join("+"), () => {
                ipcMainSendMainWindow("navigate", `evt://${shortCutKeysEvts[key]}`);
            });


            const newConfig = {
                ...prevConfig,
                [key]: {
                    ...(prevConfig[key] || {}),
                    global: reg ? shortCut : null
                }
            }

            AppConfig.setConfig({
                "shortCut.shortcuts": newConfig
            });

        }
    } catch {
    }
}

async function unregisterShortCut(key: IShortCutKeys, shortCut: string[]) {
    if (shortCut?.length) {
        globalShortcut.unregister(shortCut.join("+"));
        const prevConfig = AppConfig.getConfig("shortCut.shortcuts");

        const newConfig = {
            ...prevConfig,
            [key]: {
                ...(prevConfig[key] || {}),
                global: null
            }
        } as IAppConfig["shortCut.shortcuts"];
        AppConfig.setConfig({
            "shortCut.shortcuts": newConfig
        });

    }
}
