import {app, BrowserWindow, globalShortcut} from "electron";
import fs from "fs";
import path from "path";
import os from 'os';
import {setAutoFreeze} from "immer";
import {setupGlobalContext} from "@/shared/global-context/main";
import {setupI18n} from "@/shared/i18n/main";
import {handleDeepLink} from "./deep-link";
import logger from "@shared/logger/main";
import {PlayerState} from "@/common/constant";
import ThumbBarUtil from "@/common/main/thumb-bar-util";
import windowManager from "@main/window-manager";
import AppConfig from "@shared/app-config/main";
import TrayManager from "@main/tray-manager";
import WindowDrag from "@shared/window-drag/main";
import {IAppConfig} from "@/types/app-config";
import axios from "axios";
import {HttpsProxyAgent} from "https-proxy-agent";
import PluginManager from "@shared/plugin-manager/main";
import ServiceManager from "@shared/service-manager/main";
import utils from "@shared/utils/main";
import messageBus from "@shared/message-bus/main";
import shortCut from "@shared/short-cut/main";
import voidCallback from "@/common/void-callback";

try {
    const appName = app.getName();
    const appVersion = app.getVersion();
    const platformOS = os.type();
    const osVersion = os.release();
    const arch = os.arch();

    const customUserAgent = `${appName}/${appVersion} (${platformOS} ${osVersion}; ${arch})`;
    app.userAgentFallback = customUserAgent;
} catch (error) {
    logger.logError("Failed to set custom User-Agent:", error as Error);
}

// portable
if (process.platform === "win32") {
    try {
        const appPath = app.getPath("exe");
        const portablePath = path.resolve(appPath, "../portable");
        const portableFolderStat = fs.statSync(portablePath);
        if (portableFolderStat.isDirectory()) {
            const appPathNames = ["appData", "userData"];
            appPathNames.forEach((it) => {
                app.setPath(it, path.resolve(portablePath, it));
            });
        }
    } catch (e) {
        // pass
    }
}

setAutoFreeze(false);


if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient("musicfree", process.execPath, [
            path.resolve(process.argv[1]),
        ]);
    }
} else {
    app.setAsDefaultProtocolClient("musicfree");
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.showMainWindow();
    }
});

if (!app.requestSingleInstanceLock()) {
    app.exit(0);
}

app.on("second-instance", (_evt, commandLine) => {
    if (windowManager.mainWindow) {
        windowManager.showMainWindow();
    }

    if (process.platform !== "darwin") {
        handleDeepLink(commandLine.pop());
    }
});

app.on("open-url", (_evt, url) => {
    handleDeepLink(url);
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
app.whenReady().then(async () => {
    logger.logPerf("App Ready");
    setupGlobalContext();
    await AppConfig.setup(windowManager);

    await setupI18n({
        getDefaultLang() {
            return AppConfig.getConfig("normal.language");
        },
        onLanguageChanged(lang) {
            AppConfig.setConfig({
                "normal.language": lang
            });
            if (process.platform === "win32") {

                ThumbBarUtil.setThumbBarButtons(windowManager.mainWindow, messageBus.getAppState().playerState === PlayerState.Playing)
            }
        },
    });
    utils.setup(windowManager);
    PluginManager.setup(windowManager);
    TrayManager.setup(windowManager);
    WindowDrag.setup();
    shortCut.setup().then(voidCallback);
    logger.logPerf("Create Main Window");
    // Setup message bus & app state
    messageBus.onAppStateChange((_, patch) => {
        if ("musicItem" in patch) {
            TrayManager.buildTrayMenu();
            const musicItem = patch.musicItem;
            const mainWindow = windowManager.mainWindow;

            if (mainWindow) {
                const thumbStyle = AppConfig.getConfig("normal.taskbarThumb");
                if (process.platform === "win32" && thumbStyle === "artwork") {
                    ThumbBarUtil.setThumbImage(mainWindow, musicItem?.artwork);
                }
                if (musicItem) {
                    mainWindow.setTitle(
                        musicItem.title + (musicItem.artist ? ` - ${musicItem.artist}` : "")
                    );
                } else {
                    mainWindow.setTitle(app.getName());
                }
            }
        } else if ("playerState" in patch) {
            TrayManager.buildTrayMenu();
            const playerState = patch.playerState;

            if (process.platform === "win32") {
                ThumbBarUtil.setThumbBarButtons(windowManager.mainWindow, playerState === PlayerState.Playing)
            }
        } else if ("repeatMode" in patch) {
            TrayManager.buildTrayMenu();
        } else if ("lyricText" in patch && process.platform === "darwin") {
            if (AppConfig.getConfig("lyric.enableStatusBarLyric")) {
                TrayManager.setTitle(patch.lyricText);
            } else {
                TrayManager.setTitle("");
            }
        }
    })

    messageBus.setup(windowManager);

    windowManager.showMainWindow();

    bootstrap();

});

async function bootstrap() {
    ServiceManager.setup(windowManager);

    const downloadPath = AppConfig.getConfig("download.path");
    if (!downloadPath) {
        AppConfig.setConfig({
            "download.path": app.getPath("downloads")
        });
    }

    const minimodeEnabled = AppConfig.getConfig("private.minimode");

    if (minimodeEnabled) {
        windowManager.showMiniModeWindow();
    }

    /** 一些初始化设置 */
        // 初始化桌面歌词
    const desktopLyricEnabled = AppConfig.getConfig("lyric.enableDesktopLyric");

    if (desktopLyricEnabled) {
        windowManager.showLyricWindow();
    }

    AppConfig.onConfigUpdated((patch) => {
        // 桌面歌词锁定状态
        if ("lyric.lockLyric" in patch) {
            const lyricWindow = windowManager.lyricWindow;
            const lockState = patch["lyric.lockLyric"];

            if (!lyricWindow) {
                return;
            }
            if (lockState) {
                lyricWindow.setIgnoreMouseEvents(true, {
                    forward: true,
                });
            } else {
                lyricWindow.setIgnoreMouseEvents(false);
            }
        }
        if ("shortCut.enableGlobal" in patch) {
            const enableGlobal = patch["shortCut.enableGlobal"];
            if (enableGlobal) {
                shortCut.registerAllGlobalShortCuts();
            } else {
                shortCut.unregisterAllGlobalShortCuts();
            }
        }
    })


    // 初始化代理
    const proxyConfigKeys: Array<keyof IAppConfig> = [
        "network.proxy.enabled",
        "network.proxy.host",
        "network.proxy.port",
        "network.proxy.username",
        "network.proxy.password"
    ];

    AppConfig.onConfigUpdated((patch, config) => {
        let proxyUpdated = false;
        for (const proxyConfigKey of proxyConfigKeys) {
            if (proxyConfigKey in patch) {
                proxyUpdated = true;
                break;
            }
        }

        if (proxyUpdated) {
            if (config["network.proxy.enabled"]) {
                handleProxy(true, config["network.proxy.host"], config["network.proxy.port"], config["network.proxy.username"], config["network.proxy.password"]);
            } else {
                handleProxy(false);
            }
        }
    });

    handleProxy(
        AppConfig.getConfig("network.proxy.enabled"),
        AppConfig.getConfig("network.proxy.host"),
        AppConfig.getConfig("network.proxy.port"),
        AppConfig.getConfig("network.proxy.username"),
        AppConfig.getConfig("network.proxy.password")
    );


}


function handleProxy(enabled: boolean, host?: string | null, port?: string | null, username?: string | null, password?: string | null) {
    try {
        if (!enabled) {
            axios.defaults.httpAgent = undefined;
            axios.defaults.httpsAgent = undefined;
        } else if (host) {
            const proxyUrl = new URL(host);
            proxyUrl.port = port;
            proxyUrl.username = username;
            proxyUrl.password = password;
            const agent = new HttpsProxyAgent(proxyUrl);

            axios.defaults.httpAgent = agent;
            axios.defaults.httpsAgent = agent;
        } else {
            throw new Error("Unknown Host");
        }
    } catch (e) {
        axios.defaults.httpAgent = undefined;
        axios.defaults.httpsAgent = undefined;
    }
}
