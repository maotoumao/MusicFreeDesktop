import AppConfig from "@shared/app-config/renderer";
import {IAppConfig} from "@/types/app-config";
import {shortCutKeys, shortCutKeysCommands} from "@/common/constant";
import hotkeys from "hotkeys-js";
import messageBus from "@shared/message-bus/renderer/main";

type IShortCutKeys = keyof IAppConfig["shortCut.shortcuts"];

interface IMod {
    registerGlobalShortCut: (key: IShortCutKeys, shortCut: string[]) => void;
    unregisterGlobalShortCut: (key: IShortCutKeys) => void;
}

const mod = window["@shared/short-cut" as any] as unknown as IMod;

const originalHotkeysFilter = hotkeys.filter;

hotkeys.filter = (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset["capture"] === "true") {
        return true;
    }
    return originalHotkeysFilter(event);
};

class ShortCut {
    private localShortCutCallbackMap = new Map<string, (...args: any[]) => void>();

    setup() {
        try {
            const shortCuts = AppConfig.getConfig("shortCut.shortcuts");
            for (const shortCutKey of shortCutKeys) {
                const localShortCutConfig = shortCuts?.[shortCutKey]?.local;
                if (localShortCutConfig?.length) {
                    this.registerLocalShortCut(shortCutKey, localShortCutConfig);
                }
            }
        } catch {
            // pass
        }
    }


    registerLocalShortCut(key: IShortCutKeys, shortCut: string[]) {
        if (!shortCut?.length) {
            return;
        }
        this.unregisterLocalShortCut(key);
        const callback = (evt: KeyboardEvent) => {
            if (AppConfig.getConfig("shortCut.enableLocal")) {
                evt.preventDefault();
                messageBus.sendCommand(shortCutKeysCommands[key]);
            }
        }
        this.localShortCutCallbackMap.set(key as string, callback);
        hotkeys(shortCut.join("+"), "all", callback);

        const shortCuts = AppConfig.getConfig("shortCut.shortcuts");
        AppConfig.setConfig({
            "shortCut.shortcuts": {
                ...(shortCuts || {} as any),
                [key]: {
                    ...(shortCuts?.[key] || {}),
                    local: shortCut
                }
            },
        })
    }

    unregisterLocalShortCut(key: IShortCutKeys) {
        const shortCuts = AppConfig.getConfig("shortCut.shortcuts");
        const prevShortCut = shortCuts?.[key]?.local;
        if (prevShortCut?.length) {
            hotkeys.unbind(prevShortCut.join("+"), "all", this.localShortCutCallbackMap.get(key as string));
            this.localShortCutCallbackMap.delete(key as string);

            AppConfig.setConfig({
                "shortCut.shortcuts": {
                    ...(shortCuts || {} as any),
                    [key]: {
                        ...(shortCuts[key] || {}),
                        local: null
                    }
                },
            })
        }
    }

    registerGlobalShortCut(key: IShortCutKeys, shortCut: string[]) {
        mod.registerGlobalShortCut(key, shortCut);
    }

    unregisterGlobalShortCut(key: IShortCutKeys) {
        mod.unregisterGlobalShortCut(key);
    }
}


const shortCut = new ShortCut();
export default shortCut;
