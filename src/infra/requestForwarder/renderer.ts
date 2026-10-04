/**
 * requestForwarder — Renderer 层
 *
 * 提供类型安全的代理 URL 构建工具。
 * 初始化时从主进程获取连接信息（端口 + 令牌）并缓存，之后 buildProxyUrl() 为纯同步计算。
 * 监听连接信息变更事件，worker 重启后自动更新。
 */

import type { IRequestForwarderInfo } from '@appTypes/infra/requestForwarder';
import { CONTEXT_BRIDGE_KEY, TOKEN_PARAM } from './common/constant';

interface IMod {
    getInfo(): Promise<IRequestForwarderInfo | null>;
    onInfoChanged(callback: (info: IRequestForwarderInfo | null) => void): () => void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

class RequestForwarder {
    private info: IRequestForwarderInfo | null = null;
    private isSetupDone = false;
    private readyResolvers: Array<() => void> = [];

    /**
     * 初始化：获取端口并注册变更监听。
     * 应在应用启动时调用一次。
     */
    async setup(): Promise<void> {
        if (this.isSetupDone) return;

        // 先注册监听再查询，避免两者之间 worker 状态变化导致错过广播。
        // 主进程每次状态变化都会广播，因此查询期间只要收到过广播，广播就不旧于查询结果，
        // 此时丢弃查询结果，防止其覆盖更新的状态（如 worker 退出后的 null）。
        let receivedBroadcast = false;
        mod.onInfoChanged((newInfo) => {
            receivedBroadcast = true;
            this.applyInfo(newInfo);
        });

        const info = await mod.getInfo();
        if (!receivedBroadcast) {
            this.applyInfo(info);
        }

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
        if (this.info !== null) return Promise.resolve();
        return new Promise<void>((resolve) => {
            this.readyResolvers.push(resolve);
        });
    }

    /** 代理服务器是否就绪 */
    isReady(): boolean {
        return this.info !== null;
    }

    /** 获取当前代理端口 */
    getPort(): number | null {
        return this.info?.port ?? null;
    }

    /**
     * 构建代理 URL
     *
     * 将访问令牌、目标 URL 和自定义 headers 编码为本地代理服务器的查询参数。
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
        const info = this.info;
        if (info === null || !this.isProxyRequired(url)) {
            return url;
        }

        const params = new URLSearchParams();
        params.set(TOKEN_PARAM, info.token);
        params.set('url', url);

        if (headers && Object.keys(headers).length > 0) {
            params.set('headers', JSON.stringify(headers));
        }

        return `http://127.0.0.1:${info.port}/?${params.toString()}`;
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

    private applyInfo(info: IRequestForwarderInfo | null): void {
        this.info = info;
        if (info !== null) {
            this.flushReadyResolvers();
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
