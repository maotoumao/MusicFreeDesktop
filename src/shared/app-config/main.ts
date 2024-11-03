import path from "path";
import {app, ipcMain} from "electron";
import originalFs from "fs";
import fs from "fs/promises";
import {rimraf} from "rimraf";
import {IAppConfig} from "@/types/app-config";
import {IWindowManager} from "@/types/main/window-manager";
import logger from "@shared/logger/main";
import _defaultAppConfig from "@shared/app-config/default-app-config";


class AppConfig {
    private _configPath: string;
    private windowManager: IWindowManager;
    private config: IAppConfig = {};

    private onAppConfigUpdatedCallbacks = new Set<(patch: IAppConfig, config: IAppConfig) => void>();

    get configPath() {
        if (!this._configPath) {
            this._configPath = path.resolve(app.getPath("userData"), "config.json");
        }
        return this._configPath;
    }


    private async checkPath() {
        // 1. Check dir
        const configDirPath = app.getPath("userData");

        try {
            const res = await fs.stat(configDirPath);
            if (!res.isDirectory()) {
                await rimraf(configDirPath);
                throw new Error("Not a valid path");
            }
        } catch {
            await fs.mkdir(configDirPath, {
                recursive: true,
            });
        }

        // 2. Check file
        try {
            const res = await fs.stat(this.configPath);
            if (!res.isFile()) {
                await rimraf(this.configPath);
                throw new Error("Not a valid path");
            }
        } catch {
            await fs.writeFile(this.configPath, "{}", "utf-8");
        }
    }

    async setup(windowManager: IWindowManager) {
        this.windowManager = windowManager;

        await this.checkPath();
        await this.loadConfig();

        // Bind events
        windowManager.on("WindowCreated", ({windowName}) => {
            if (windowName === "main") {
                // sync config
                ipcMain.handle("sync-app-config", () => {
                    return this.config;
                });

                ipcMain.on("set-app-config", (_rawEvt, data: IAppConfig) => {
                    /**
                     * data: {key: value}
                     */
                    this.setConfig(data);
                })
            }
        })
    }

    public onConfigUpdated(callback: (patch: IAppConfig, config: IAppConfig) => void) {
        this.onAppConfigUpdatedCallbacks.add(callback);
    }

    async loadConfig() {
        try {
            if (this.config) {
                return this.config;
            } else {
                const rawConfig = await fs.readFile(this.configPath, "utf8");
                this.config = JSON.parse(rawConfig);
            }
        } catch (e) {
            if (e.message === "Unexpected end of JSON input" || e.code === "EISDIR") {
                // JSON 解析异常 / 非文件
                await rimraf(this.configPath);
                await this.checkPath();
            } else if (e.code === "ENOENT") {
                // 文件不存在
                await this.checkPath();
            }
            this.config = {};
        }
        return this.config;
    }

    public getAllConfig() {
        return this.config;
    }

    public getConfig<T extends keyof IAppConfig>(key: T): IAppConfig[T] {
        return this.config[key];
    }

    public setConfig(data: IAppConfig) {
        try {
            // 1. Merge old one
            this.config = {..._defaultAppConfig, ...this.config, ...data};
            // 2. Save to file
            const rawConfig = JSON.stringify(this.config, undefined, 4);
            originalFs.writeFileSync(this.configPath, rawConfig, "utf-8");
            // 3. Notify to all windows
            this.windowManager.getAllWindows().forEach((window) => {
                window.webContents.send("set-app-config", data);
            })

            this.onAppConfigUpdatedCallbacks.forEach((callback) => {
                callback(data, this.config);
            })

        } catch (e) {
            logger.logError("设置配置失败", e);
        }
    }

}

export default new AppConfig();
