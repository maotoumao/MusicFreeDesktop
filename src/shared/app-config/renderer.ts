import {IAppConfig} from "@/types/app-config";
import _defaultAppConfig from "@shared/app-config/default-app-config";
import defaultAppConfig from "@shared/app-config/default-app-config";


interface IMod {
    syncConfig(): Promise<IAppConfig>;

    setConfig(config: IAppConfig): void;

    onConfigUpdate(callback: (config: IAppConfig) => void): void;

    reset(): void;
}

const mod = window["@shared/app-config" as any] as unknown as IMod

class AppConfig {
    private config: IAppConfig = {};

    public initialized = false;

    private updateCallbacks: Set<(patch: IAppConfig, config: IAppConfig) => void> = new Set();

    private notifyCallbacks(patch: IAppConfig) {
        for (const callback of this.updateCallbacks) {
            callback(patch, this.config);
        }
    }

    async setup() {
        this.initialized = true;
        this.config = await mod.syncConfig();
        this.notifyCallbacks(this.config);

        mod.onConfigUpdate((patch) => {
            this.config = {..._defaultAppConfig, ...this.config, ...patch};
            this.notifyCallbacks(patch);
        })
    }

    public onConfigUpdate(callback: (patch: IAppConfig, config: IAppConfig) => void) {
        this.updateCallbacks.add(callback);
    }

    public offConfigUpdate(callback: (patch: IAppConfig, config: IAppConfig) => void) {
        this.updateCallbacks.delete(callback);
    }

    public getAllConfig() {
        return this.config;
    }

    public getConfig<T extends keyof IAppConfig>(key: T): IAppConfig[T] {
        return this.config[key];
    }

    public setConfig(data: IAppConfig) {
        mod.setConfig(data);
    }

    public reset() {
        mod.reset();
        this.config = defaultAppConfig;
        this.notifyCallbacks(this.config);
    }

}

export default new AppConfig();
