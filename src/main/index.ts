// src/main/index.ts
import {app, BrowserWindow, globalShortcut} from "electron";
import fs from "fs"; // 修改：直接使用 fs/promises 导入的 fs
import path from "path";
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
import mpvManager from "./mpv-manager"; // 新增

// portable
if (process.platform === "win32") {
    try {
        const appPath = app.getPath("exe");
        const portablePath = path.resolve(appPath, "../portable");
        const portableFolderStat = fs.statSync(portablePath); // 注意：fs.statSync 是同步的
        if (portableFolderStat.isDirectory()) {
            const appPathNames = ["appData", "userData"];
            appPathNames.forEach((it) => {
                app.setPath(it as any, path.resolve(portablePath, it)); //  'it' implicitly has type 'any'
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

app.on("will-quit", async () => { // 修改为 async
    globalShortcut.unregisterAll();
    if (AppConfig.getConfig("playMusic.backend") === "mpv") { // 新增条件判断
        await mpvManager.quitMpv().catch(voidCallback); // 修改
    }
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
                    mainWindow.setTitle(app.name);
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
    windowManager.showMainWindow(); // 这会创建 mainWindow

    // 确保 mainWindow 创建后再设置给 mpvManager
    if (windowManager.mainWindow) {
        mpvManager.setMainWindow(windowManager.mainWindow); // 新增
        if (AppConfig.getConfig("playMusic.backend") === "mpv") {
            mpvManager.initializeMpv(true).catch(err => { // 修改
              logger.logError("Initial MPV initialization failed on app ready:", err);
            });
        }
    } else {
        // 如果 mainWindow 由于某些原因未能立即创建，可以监听 windowManager 的事件
        windowManager.on("WindowCreated", (data) => {
            if (data.windowName === "main" && data.browserWindow) {
                mpvManager.setMainWindow(data.browserWindow);
                if (AppConfig.getConfig("playMusic.backend") === "mpv") {
                     mpvManager.initializeMpv(true).catch(err => { // 修改
                        logger.logError("Initial MPV initialization failed (deferred):", err);
                    });
                }
            }
        });
    }

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

    const desktopLyricEnabled = AppConfig.getConfig("lyric.enableDesktopLyric");

    if (desktopLyricEnabled) {
        windowManager.showLyricWindow();
    }

    AppConfig.onConfigUpdated(async (patch) => { // 修改为 async
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

        // 新增：处理播放后端切换
        if (patch["playMusic.backend"] !== undefined) {
            if (AppConfig.getConfig("playMusic.backend") === "mpv") {
                if (windowManager.mainWindow) { // 确保 mainWindow 存在
                    mpvManager.setMainWindow(windowManager.mainWindow);
                    await mpvManager.initializeMpv(true).catch(err => { // 修改
                      logger.logError("MPV initialization failed on config change:", err);
                    });
                }
            } else {
                await mpvManager.quitMpv().catch(voidCallback); // 修改
            }
        }
         // 新增：处理 MPV 路径或参数变化
        if (patch["playMusic.mpvPath"] !== undefined || patch["playMusic.mpvArgs"] !== undefined) {
            if (AppConfig.getConfig("playMusic.backend") === "mpv") {
                logger.logInfo("MPV path or args changed, re-initializing MPV.");
                if (windowManager.mainWindow) {
                     mpvManager.setMainWindow(windowManager.mainWindow);
                     await mpvManager.initializeMpv(true).catch(err => { // 修改
                        logger.logError("MPV re-initialization failed after path/args change:", err);
                    });
                }
            }
        }
    })

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
            const proxyUrl = new URL(host.startsWith("http") ? host : `http://${host}`); // 确保有协议头
            proxyUrl.port = port || proxyUrl.port; // 如果 port 为空，则使用 URL 中的 port
            if (username) proxyUrl.username = username;
            if (password) proxyUrl.password = password;

            const agent = new HttpsProxyAgent(proxyUrl.toString()); // HttpsProxyAgent 接受字符串 URL

            axios.defaults.httpAgent = agent;
            axios.defaults.httpsAgent = agent;
        } else {
            // 如果启用了代理但主机未设置，则清除代理设置
            axios.defaults.httpAgent = undefined;
            axios.defaults.httpsAgent = undefined;
        }
    } catch (e) {
        logger.logError("Error setting up proxy:", e);
        axios.defaults.httpAgent = undefined;
        axios.defaults.httpsAgent = undefined;
    }
}