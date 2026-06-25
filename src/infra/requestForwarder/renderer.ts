/**
 * requestForwarder — Renderer 层
 *
 * 提供类型安全的代理 URL 构建工具。
 * 初始化时从主进程获取端口并缓存，之后 buildProxyUrl() 为纯同步计算。
 * 监听端口变更事件，worker 重启后自动更新。
 */

import { CONTEXT_BRIDGE_KEY } from './common/constant';

interface IMod {
    getPort(): Promise<number | null>;
    onPortChanged(callback: (port: number | null) => void): () => void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

class RequestForwarder {
    private port: number | null = null;
    private isSetupDone = false;
    private readyResolvers: Array<() => void> = [];

    /**
     * 初始化：获取端口并注册变更监听。
     * 应在应用启动时调用一次。
     */
    async setup(): Promise<void> {
        if (this.isSetupDone) return;

        this.port = await mod.getPort();
        if (this.port !== null) {
            this.flushReadyResolvers();
        }

        mod.onPortChanged((newPort) => {
            this.port = newPort;
            if (newPort !== null) {
                this.flushReadyResolvers();
            }
        });

        this.isSetupDone = true;
    }

    /**
     * 返回一个 Promise，在代理端口可用时 resolve。
     * 如果已就绪则立即 resolve。
     *
     * @example
     * ```ts
     * await requestForwarder.whenReady();
     * audioElement.src = requestForwarder.buildProxyUrl(url, headers);
     * ```
     */
    whenReady(): Promise<void> {
        if (this.port !== null) return Promise.resolve();
        return new Promise<void>((resolve) => {
            this.readyResolvers.push(resolve);
        });
    }

    /** 代理服务器是否就绪 */
    isReady(): boolean {
        return this.port !== null;
    }

    /** 获取当前代理端口 */
    getPort(): number | null {
        return this.port;
    }

    /**
     * 构建代理 URL
     *
     * 将目标 URL 和自定义 headers 编码为本地代理服务器的查询参数。
     * 如果代理未就绪或 URL 不需要代理，返回原始 URL（优雅降级）。
     *
     * @param url 目标音频 URL
     * @param headers 需要附加的自定义 HTTP 头
     * @returns 代理 URL 或原始 URL
     *
     * @example
     * ```ts
     * const src = requestForwarder.buildProxyUrl(
     *     'https://example.com/audio.mp3',
     *     { 'Referer': 'https://example.com', 'Cookie': 'session=abc' }
     * );
     * audioElement.src = src;
     * ```
     */
    buildProxyUrl(url: string, headers?: Record<string, string>): string {
        if (!this.isReady() || !this.isProxyRequired(url)) {
            return url;
        }

        const params = new URLSearchParams();
        params.set('url', url);

        if (headers && Object.keys(headers).length > 0) {
            params.set('headers', JSON.stringify(headers));
        }

        return `http://127.0.0.1:${this.port}/?${params.toString()}`;
    }

    /**
     * 判断 URL 是否需要走代理
     *
     * 仅 http/https 协议的 URL 需要代理，
     * blob:、data:、file: 等协议直接播放即可。
     */
    isProxyRequired(url: string): boolean {
        try {
            const protocol = new URL(url).protocol;
            return protocol === 'http:' || protocol === 'https:';
        } catch {
            return false;
        }
    }

    private flushReadyResolvers(): void {
        for (const resolve of this.readyResolvers) {
            resolve();
        }
        this.readyResolvers = [];
    }
}

const requestForwarder = new RequestForwarder();
export default requestForwarder;
