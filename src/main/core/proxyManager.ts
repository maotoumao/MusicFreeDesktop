/**
 * ProxyManager — 代理管理器
 *
 * 监听 appConfig 中 network.proxy.* 变更，
 * 将代理配置统一分发到所有网络出口：
 *   1. Electron Session（渲染进程请求）
 *   2. 全局 axios defaults（downloadManager / pluginManager / 插件沙箱）
 *   3. RequestForwarder Worker（音频流转发）
 */

import { app, session } from 'electron';
import axios from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { IAppConfigReader, IAppConfig } from '@appTypes/infra/appConfig';

const PROXY_CONFIG_KEYS: Array<keyof IAppConfig> = [
    'network.proxy.enabled',
    'network.proxy.host',
    'network.proxy.port',
    'network.proxy.username',
    'network.proxy.password',
];

interface IProxyConfig {
    proxyUrl: string;
    host: string;
    port: string;
}

class ProxyManager {
    private appConfig: IAppConfigReader | null = null;
    private updateWorkerProxy: ((proxyUrl: string | null) => void) | null = null;

    async setup(opts: {
        appConfig: IAppConfigReader;
        updateWorkerProxy: (proxyUrl: string | null) => void;
    }) {
        this.appConfig = opts.appConfig;
        this.updateWorkerProxy = opts.updateWorkerProxy;

        // 处理认证代理（login 事件在 app 对象上）
        app.on('login', (event, _webContents, _details, authInfo, callback) => {
            if (authInfo.isProxy && this.appConfig) {
                const user = this.appConfig.getConfigByKey('network.proxy.username');
                if (user) {
                    event.preventDefault();
                    const pass = this.appConfig.getConfigByKey('network.proxy.password');
                    callback(user, pass ?? '');
                }
            }
        });

        await this.apply();

        this.appConfig.onConfigUpdated((patch) => {
            if (PROXY_CONFIG_KEYS.some((k) => k in patch)) {
                this.apply();
            }
        });
    }

    /** 根据当前配置构建代理信息，未启用时返回 null */
    private buildProxyConfig(): IProxyConfig | null {
        if (!this.appConfig) return null;

        const enabled = this.appConfig.getConfigByKey('network.proxy.enabled');
        const host = this.appConfig.getConfigByKey('network.proxy.host');
        const port = this.appConfig.getConfigByKey('network.proxy.port');

        if (!enabled || !host || !port) return null;

        const user = this.appConfig.getConfigByKey('network.proxy.username');
        const pass = this.appConfig.getConfigByKey('network.proxy.password');
        const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pass ?? '')}@` : '';

        return { proxyUrl: `http://${auth}${host}:${port}`, host, port };
    }

    /** 将代理配置应用到所有网络出口 */
    private async apply() {
        const config = this.buildProxyConfig();

        // 1) Electron Session — 影响渲染进程所有网络请求
        if (config) {
            await session.defaultSession.setProxy({
                proxyRules: `http://${config.host}:${config.port}`,
            });
        } else {
            await session.defaultSession.setProxy({ mode: 'direct' });
        }

        // 2) 全局 axios defaults — 覆盖 downloadManager / pluginManager / 插件沙箱
        if (config) {
            axios.defaults.httpAgent = new HttpProxyAgent(config.proxyUrl);
            axios.defaults.httpsAgent = new HttpsProxyAgent(config.proxyUrl);
        } else {
            axios.defaults.httpAgent = undefined;
            axios.defaults.httpsAgent = undefined;
        }

        // 3) RequestForwarder Worker — 通过 IPC 传递代理地址
        this.updateWorkerProxy?.(config?.proxyUrl ?? null);

        console.log(
            '[ProxyManager] Applied proxy:',
            config ? `${config.host}:${config.port}` : 'direct',
        );
    }
}

const proxyManager = new ProxyManager();
export default proxyManager;
