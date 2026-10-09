/**
 * appConfig — 渲染进程层
 *
 * 职责：
 * - 封装 Preload Bridge，提供类型安全的配置读写 API
 * - 内存缓存配置，支持同步读取
 * - 事件驱动的配置变更通知
 */
import type { IAppConfig, ConfigSource } from '@appTypes/infra/appConfig';
import defaultAppConfig from './common/defaultAppConfig';
import { CONTEXT_BRIDGE_KEY } from './common/constant';

interface IMod {
    syncConfig(): Promise<IAppConfig>;

    setConfig(config: IAppConfig): void;

    onConfigUpdate(callback: (config: IAppConfig, source: ConfigSource) => void): () => void;

    reset(): void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

class AppConfig {
    public initialized = false;

    private config: IAppConfig = {};

    private updateCallbacks: Set<
        (patch: IAppConfig, config: IAppConfig, source: ConfigSource) => void
    > = new Set();

    async setup() {
        this.initialized = true;
        this.config = await mod.syncConfig();
        this.notifyCallbacks(this.config, 'main');

        mod.onConfigUpdate((patch, source) => {
            this.config = { ...defaultAppConfig, ...this.config, ...patch };
            this.notifyCallbacks(patch, source);
        });
    }

    public onConfigUpdated(
        callback: (patch: IAppConfig, config: IAppConfig, source: ConfigSource) => void,
    ) {
        this.updateCallbacks.add(callback);
    }

    public offConfigUpdated(
        callback: (patch: IAppConfig, config: IAppConfig, source: ConfigSource) => void,
    ) {
        this.updateCallbacks.delete(callback);
    }

    public getConfig() {
        return this.config;
    }

    public getConfigByKey<T extends keyof IAppConfig>(key: T): IAppConfig[T] {
        return this.config[key];
    }

    public setConfig(data: IAppConfig) {
        mod.setConfig(data);
    }

    public reset() {
        mod.reset();
        this.config = defaultAppConfig;
        this.notifyCallbacks(this.config, 'main');
    }

    private notifyCallbacks(patch: IAppConfig, source: ConfigSource) {
        for (const callback of this.updateCallbacks) {
            callback(patch, this.config, source);
        }
    }
}

const appConfig = new AppConfig();
export default appConfig;
