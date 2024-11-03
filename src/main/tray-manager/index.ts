import {app, Menu, MenuItem, MenuItemConstructorOptions, nativeImage, Tray} from "electron";
import {t} from "@shared/i18n/main";
import {IWindowManager} from "@/types/main/window-manager";
import getResourcePath from "@/utils/main/get-resource-path";
import {PlayerState, RepeatMode, ResourceName} from "@/common/constant";
import AppState from "@shared/app-state/main";
import AppConfig from "@shared/app-config.new/main";
import {sendCommand} from "@shared/player-command-sync/main";
import windowManager from "@main/window-manager";
import {IAppConfig} from "@/types/app-config";

if (process.platform === "darwin") {
    Menu.setApplicationMenu(
        Menu.buildFromTemplate([
            {
                label: app.getName(),
                submenu: [
                    {
                        label: t("common.about"),
                        role: "about",
                    },
                    {
                        label: t("common.exit"),
                        click() {
                            app.quit();
                        },
                    },
                ],
            },
            {
                label: t("common.edit"),
                submenu: [
                    {
                        label: t("common.undo"),
                        accelerator: "Command+Z",
                        role: "undo",
                    },
                    {
                        label: t("common.redo"),
                        accelerator: "Shift+Command+Z",
                        role: "redo",
                    },
                    {type: "separator"},
                    {label: t("common.cut"), accelerator: "Command+X", role: "cut"},
                    {label: t("common.copy"), accelerator: "Command+C", role: "copy"},
                    {label: t("common.cut"), accelerator: "Command+V", role: "paste"},
                    {type: "separator"},
                    {
                        label: t("common.select_all"),
                        accelerator: "Command+A",
                        role: "selectAll",
                    },
                ],
            },
        ])
    );
} else {
    Menu.setApplicationMenu(null);
}

class TrayManager {
    private static trayInstance: Tray | null = null;
    private windowManager: IWindowManager;

    private observedKey: Array<keyof IAppConfig> = [
        "lyric.lockLyric",
        "lyric.enableDesktopLyric",
        "normal.language"
    ]

    public setup(windowManager: IWindowManager) {
        this.windowManager = windowManager;
        const tray = new Tray(
            nativeImage.createFromPath(getResourcePath(ResourceName.LOGO_IMAGE)).resize({
                width: 32,
                height: 32,
            })
        );

        if (process.platform === "linux") {
            tray.on("click", () => {
                windowManager.showMainWindow();
            });
        } else {
            tray.on("double-click", () => {
                windowManager.showMainWindow();
            });
        }

        // 配置变化时更新菜单
        AppConfig.onConfigUpdated((changedConfig) => {
            for (const k of this.observedKey) {
                if (k in changedConfig) {
                    this.buildTrayMenu();
                    return;
                }
            }
        })

        TrayManager.trayInstance = tray;
        this.buildTrayMenu();
    }

    private openMusicDetail() {
        this.windowManager.showMainWindow();
        // todo: normalize
        this.windowManager.mainWindow.webContents.send("navigate", "evt://SHOW_MUSIC_DETAIL");
    }

    public async buildTrayMenu() {
        if (!TrayManager.trayInstance) {
            return;
        }
        const ctxMenu: Array<MenuItemConstructorOptions | MenuItem> = [];

        const tray = TrayManager.trayInstance;

        /********* 音乐信息 **********/
        const {music, playerState, repeatMode} =
            AppState;
        // 更新一下tooltip
        if (music) {
            tray.setToolTip(
                `${music.title ?? t("media.unknown_title")}${
                    music.artist ? ` - ${music.artist}` : ""
                }`
            );
        } else {
            tray.setToolTip("MusicFree");
        }
        if (music) {
            const fullName = `${music.title ?? t("media.unknown_title")}${
                music.artist ? ` - ${music.artist}` : ""
            }`;
            ctxMenu.push(
                {
                    label: fullName.length > 12 ? fullName.slice(0, 12) + "..." : fullName,
                    click: this.openMusicDetail.bind(this),
                },
                {
                    label: `${t("media.media_platform")}: ${music.platform}`,
                    click: this.openMusicDetail.bind(this),
                }
            );
        } else {
            ctxMenu.push({
                label: t("main.no_playing_music"),
                enabled: false,
            });
        }

        ctxMenu.push(
            {
                label: music
                    ? playerState === PlayerState.Playing
                        ? t("media.music_state_pause")
                        : t("media.music_state_play")
                    : t("media.music_state_play_or_pause"),
                enabled: !!music,
                click() {
                    if (!music) {
                        return;
                    }
                    sendCommand(
                        "SetPlayerState",
                        playerState === PlayerState.Playing
                            ? PlayerState.Paused
                            : PlayerState.Playing
                    );
                },
            },
            {
                label: t("main.previous_music"),
                enabled: !!music,
                click() {
                    sendCommand("SkipToPrevious");
                },
            },
            {
                label: t("main.next_music"),
                enabled: !!music,
                click() {
                    sendCommand("SkipToNext");
                },
            }
        );

        ctxMenu.push({
            label: t("media.music_repeat_mode"),
            type: "submenu",
            submenu: Menu.buildFromTemplate([
                {
                    label: t("media.music_repeat_mode_loop"),
                    id: RepeatMode.Loop,
                    type: "radio",
                    checked: repeatMode === RepeatMode.Loop,
                    click() {
                        sendCommand("SetRepeatMode", RepeatMode.Loop);
                    },
                },
                {
                    label: t("media.music_repeat_mode_queue"),
                    id: RepeatMode.Queue,
                    type: "radio",
                    checked: repeatMode === RepeatMode.Queue,
                    click() {
                        sendCommand("SetRepeatMode", RepeatMode.Queue);
                    },
                },
                {
                    label: t("media.music_repeat_mode_shuffle"),
                    id: RepeatMode.Shuffle,
                    type: "radio",
                    checked: repeatMode === RepeatMode.Shuffle,
                    click() {
                        sendCommand("SetRepeatMode", RepeatMode.Shuffle);
                    },
                },
            ]),
        });

        ctxMenu.push({
            type: "separator",
        });
        /** TODO: 桌面歌词 */
        // const lyricConfig = await getAppConfigPath("lyric");
        // if (lyricConfig?.enableDesktopLyric) {
        //     ctxMenu.push({
        //         label: t("main.close_desktop_lyric"),
        //         click() {
        //             setLyricWindow(false);
        //         },
        //     });
        // } else {
        //     ctxMenu.push({
        //         label: t("main.open_desktop_lyric"),
        //         click() {
        //             setLyricWindow(true);
        //         },
        //     });
        // }
        //
        // if (lyricConfig?.lockLyric) {
        //     ctxMenu.push({
        //         label: t("main.unlock_desktop_lyric"),
        //         click() {
        //             setDesktopLyricLock(false);
        //         },
        //     });
        // } else {
        //     ctxMenu.push({
        //         label: t("main.lock_desktop_lyric"),
        //         click() {
        //             setDesktopLyricLock(true);
        //         },
        //     });
        // }

        ctxMenu.push({
            type: "separator",
        });
        /********* 其他操作 **********/
        ctxMenu.push({
            label: t("app_header.settings"),
            click() {
                windowManager.showMainWindow();
                windowManager.mainWindow.webContents.send("navigate", "/main/setting");
            },
        });
        ctxMenu.push({
            label: t("common.exit"),
            role: "quit",
            click() {
                app.exit(0);
            },
        });

        TrayManager.trayInstance.setContextMenu(Menu.buildFromTemplate(ctxMenu));
    }

    public setTitle(title: string) {
        if (!title || !title.length) {
            TrayManager.trayInstance?.setTitle("");
            return;
        }
        if (title.length > 7) {
            TrayManager.trayInstance?.setTitle(" " + title.slice(0) + "...");
        } else {
            TrayManager.trayInstance?.setTitle(" " + title);
        }
    }

}

export default new TrayManager();
