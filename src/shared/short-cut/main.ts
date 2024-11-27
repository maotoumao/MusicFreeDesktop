import {globalShortcut, ipcMain} from "electron";
import AppConfig from "@/providers/app-config/main";
import {IAppConfig} from "@/types/app-config";
import {shortCutKeys, shortCutKeysCommands} from "@/common/constant";
import messageBus from "@shared/message-bus/main";

type IShortCutKeys = keyof IAppConfig["shortCut.shortcuts"];

class ShortCut {
    async setup() {
        await this.registerAllGlobalShortCuts();

        ipcMain.on("@shared/short-cut/register-global-short-cut", async (_, key, shortCut) => {
            await this.registerGlobalShortCut(key, shortCut);
        })

        ipcMain.on("@shared/short-cut/unregister-global-short-cut", async (_, key) => {
            await this.unregisterGlobalShortCut(key);
        })
    }

    public async registerAllGlobalShortCuts() {
        try {
            const shortCuts = AppConfig.getConfig("shortCut.shortcuts");
            for (const shortCutKey of shortCutKeys) {
                const globalShortCutConfig = shortCuts?.[shortCutKey]?.global;

                if (globalShortCutConfig?.length) {
                    await this.registerGlobalShortCut(shortCutKey, globalShortCutConfig);
                }
            }
        } catch {
            // pass;
        }
    }

    public unregisterAllGlobalShortCuts() {
        globalShortcut.unregisterAll();
    }


    public async registerGlobalShortCut(key: IShortCutKeys, shortCut: string[]) {
        try {
            if (shortCut.length) {
                // 1. 取之前的快捷键
                const prevConfig = AppConfig.getConfig("shortCut.shortcuts");

                if (prevConfig?.[key]?.global?.length) {
                    globalShortcut.unregister(prevConfig[key].global.join("+"));
                }

                // 2. 注册新的快捷键
                const reg = globalShortcut.register(shortCut.join("+"), () => {
                    messageBus.sendCommand(shortCutKeysCommands[key]);
                });

                // 3. 合并配置
                const newConfig = {
                    ...(prevConfig || {} as any),
                    [key]: {
                        ...(prevConfig?.[key] || {}),
                        global: reg ? shortCut : null
                    }
                }
                // 4. 更新配置
                AppConfig.setConfig({
                    "shortCut.shortcuts": newConfig
                });
            }
        } catch {
            // pass
        }
    }


    public async unregisterGlobalShortCut(key: IShortCutKeys) {
        const prevShortCut = AppConfig.getConfig("shortCut.shortcuts")?.[key]?.global;
        if (prevShortCut?.length) {
            // 1. 注销快捷键
            globalShortcut.unregister(prevShortCut.join("+"));
            // 2. 更新配置
            const prevConfig = AppConfig.getConfig("shortCut.shortcuts");
            const newConfig = {
                ...(prevConfig || {} as any),
                [key]: {
                    ...(prevConfig?.[key] || {}),
                    global: null
                }
            } as IAppConfig["shortCut.shortcuts"];
            AppConfig.setConfig({
                "shortCut.shortcuts": newConfig
            });
        }
    }
}


const shortCut = new ShortCut();
export default shortCut;
