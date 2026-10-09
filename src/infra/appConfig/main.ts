/**
 * appConfig — 主进程层
 *
 * 职责：
 * - 读写应用配置文件（JSON）
 * - 通过 IPC 向渲染进程同步/推送配置
 * - 原子化写入（临时文件 + rename），防止写入中断导致数据丢失
 * - 串行化写入队列，避免并发 rename 导致 EPERM
 */
import path from 'path';
import { app, ipcMain } from 'electron';
import fsp from 'fs/promises';
import { nanoid } from 'nanoid';

import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IAppConfig, ConfigSource } from '@appTypes/infra/appConfig';
import defaultAppConfig from './common/defaultAppConfig';
import { IPC } from './common/constant';

class AppConfig {
    private windowManager: IWindowManager;
    private config: IAppConfig;
    private isSetup = false;

    private onAppConfigUpdatedCallbacks = new Set<
        (patch: IAppConfig, config: IAppConfig, source: ConfigSource) => void
    >();

    /** 写入串行化：当前正在执行的写入 Promise */
    private writeInFlight: Promise<void> | null = null;
    /** 等待写入的最新内容（合并后只保留最新） */
    private pendingWrite: string | null = null;

    public get configPath(): string {
        this._configPath ??= path.resolve(app.getPath('userData'), 'config.json');
        return this._configPath;
    }
    private _configPath: string;

    public async setup(windowManager: IWindowManager) {
        this.windowManager = windowManager;

        if (this.isSetup) {
            return;
        }

        await this.checkPath();
        await this.loadConfig();

        ipcMain.handle(IPC.SYNC_APP_CONFIG, () => {
            return this.config;
        });

        ipcMain.on(IPC.SET_APP_CONFIG, (_rawEvt, data: IAppConfig) => {
            void this.setConfig(data, true, 'renderer');
        });

        ipcMain.on(IPC.RESET, () => {
            void this.resetConfig();
        });

        this.isSetup = true;
    }

    public async loadConfig() {
        try {
            if (this.config) {
                return { ...defaultAppConfig, ...this.config };
            }

            const rawConfig = await fsp.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(rawConfig);
            this.config = {
                ...defaultAppConfig,
                ...this.config,
            };
        } catch (e) {
            if (e.message === 'Unexpected end of JSON input' || e.code === 'EISDIR') {
                await fsp.rm(this.configPath, { recursive: true, force: true });
                await this.checkPath();
            } else if (e.code === 'ENOENT') {
                await this.checkPath();
            }
            this.config = { ...defaultAppConfig };
        }
        return this.config;
    }

    public getConfig() {
        return this.config;
    }

    public getConfigByKey<T extends keyof IAppConfig>(key: T): IAppConfig[T] {
        return this.config[key];
    }

    public onConfigUpdated(
        callback: (patch: IAppConfig, config: IAppConfig, source: ConfigSource) => void,
    ) {
        this.onAppConfigUpdatedCallbacks.add(callback);
    }

    public offConfigUpdated(
        callback: (patch: IAppConfig, config: IAppConfig, source: ConfigSource) => void,
    ) {
        this.onAppConfigUpdatedCallbacks.delete(callback);
    }

    public async resetConfig() {
        this.config = {};
        await this.setConfig({});
    }

    public async setConfig(data: IAppConfig, patchMode = true, source: ConfigSource = 'main') {
        const nextConfig = {
            ...defaultAppConfig,
            ...(patchMode ? this.config : {}),
            ...data,
        };

        // 立即更新内存中的 config，保证后续 setConfig 能读到最新值
        this.config = nextConfig;

        // 同步触发广播和回调，确保 UI 立即响应
        this.windowManager?.broadcast(IPC.UPDATE_APP_CONFIG, data, source);
        this.onAppConfigUpdatedCallbacks.forEach((callback) => {
            callback(data, this.config, source);
        });

        // 文件写入异步串行化
        try {
            const rawConfig = JSON.stringify(nextConfig, undefined, 4);
            await this.writeConfigAtomically(rawConfig);
        } catch (e) {
            console.error('Failed to set app config', e);
        }
    }

    private async checkPath() {
        const configDirPath = app.getPath('userData');

        try {
            const res = await fsp.stat(configDirPath);
            if (!res.isDirectory()) {
                await fsp.rm(configDirPath, { recursive: true, force: true });
                throw new Error('Not a valid path');
            }
        } catch {
            await fsp.mkdir(configDirPath, {
                recursive: true,
            });
        }

        try {
            const res = await fsp.stat(this.configPath);
            if (!res.isFile()) {
                await fsp.rm(this.configPath, { recursive: true, force: true });
                throw new Error('Not a valid path');
            }
        } catch {
            await fsp.writeFile(
                this.configPath,
                JSON.stringify(defaultAppConfig, undefined, 4),
                'utf-8',
            );
        }
    }

    /**
     * 串行化写入：保证同一时间只有一个 rename 操作。
     * 如果写入期间有新的请求进来，只保留最新的内容，
     * 等当前写入完成后再执行一次，避免并发 rename 导致 EPERM。
     */
    private async writeConfigAtomically(rawConfig: string) {
        if (this.writeInFlight) {
            // 已有写入在执行，只更新待写内容（合并：最新的覆盖之前的）
            this.pendingWrite = rawConfig;
            return this.writeInFlight;
        }

        this.writeInFlight = this.doWriteConfig(rawConfig);
        try {
            await this.writeInFlight;
        } finally {
            this.writeInFlight = null;
        }

        // 处理在写入期间积累的新内容
        if (this.pendingWrite !== null) {
            const next = this.pendingWrite;
            this.pendingWrite = null;
            await this.writeConfigAtomically(next);
        }
    }

    private async doWriteConfig(rawConfig: string) {
        const tempConfigPath = `${this.configPath}.${nanoid()}.tmp`;
        try {
            await fsp.writeFile(tempConfigPath, rawConfig, 'utf-8');
            await fsp.rename(tempConfigPath, this.configPath);
        } catch (error) {
            await fsp.rm(tempConfigPath, { force: true }).catch(() => {});
            throw error;
        }
    }
}

const appConfig = new AppConfig();
export default appConfig;
