/**
 * mediaMeta — Renderer 层
 *
 * 职责：
 * - 内存缓存 + 异步读写 API
 * - 事件驱动缓存更新（监听 Main 侧广播）
 *
 * 设计定位：mediaMeta 是附加信息的读写层，不是 UI 状态。
 * 不提供 React Hook，需要响应式状态的模块（如 downloadManager）自行管理订阅。
 */

import { compositeKey } from '@common/mediaKey';
import { CONTEXT_BRIDGE_KEY } from './common/constant';
import type { IMediaMeta, MediaMetaPatch, IMediaMetaChangeEvent } from '@appTypes/infra/mediaMeta';

// ─── Preload Bridge ───

interface IMod {
    getMeta(platform: string, musicId: string): Promise<IMediaMeta | null>;
    batchGetMeta(
        keys: Array<{ platform: string; musicId: string }>,
    ): Promise<Array<[string, IMediaMeta]>>;
    setMeta(platform: string, musicId: string, patch: MediaMetaPatch): Promise<void>;
    deleteMeta(platform: string, musicId: string): Promise<void>;
    queryByField(
        field: string,
    ): Promise<Array<{ platform: string; musicId: string; meta: IMediaMeta }>>;
    onMetaChanged(cb: (event: IMediaMetaChangeEvent) => void): () => void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── MediaMetaRenderer ───

type MetaChangeListener = (event: IMediaMetaChangeEvent) => void;

class MediaMetaRenderer {
    private isSetup = false;

    /** 内存缓存（按需加载 + 事件驱动更新） */
    private cache = new Map<string, IMediaMeta>();

    /** meta 变更监听器 */
    private changeListeners = new Set<MetaChangeListener>();

    /** 注销 preload 事件监听的清理函数 */
    private disposeListener: (() => void) | null = null;

    async setup() {
        if (this.isSetup) return;

        // 监听 Main 侧广播的变更事件，保持缓存一致
        this.disposeListener = mod.onMetaChanged((event) => {
            const { platform, musicId, meta } = event;
            const key = compositeKey(platform, musicId);

            if (meta) {
                this.cache.set(key, meta);
            } else {
                this.cache.delete(key);
            }

            // 转发给外部监听器
            for (const listener of this.changeListeners) {
                try {
                    listener(event);
                } catch (e) {
                    console.error('[mediaMeta] change listener error:', e);
                }
            }
        });

        this.isSetup = true;
    }

    /** 释放资源（事件监听、缓存） */
    public dispose() {
        this.disposeListener?.();
        this.disposeListener = null;
        this.changeListeners.clear();
        this.cache.clear();
        this.isSetup = false;
    }

    /**
     * 注册 meta 变更监听器。
     * 返回注销函数。供其他模块（如 downloadManager）订阅变更。
     */
    public onMetaChanged(listener: MetaChangeListener): () => void {
        this.changeListeners.add(listener);
        return () => {
            this.changeListeners.delete(listener);
        };
    }

    /** 同步获取（缓存命中）— 未命中返回 null，需提前预加载 */
    public getMetaSync(platform: string, musicId: string): IMediaMeta | null {
        return this.cache.get(compositeKey(platform, musicId)) ?? null;
    }

    /** 异步获取（缓存未命中走 IPC，结果写入缓存） */
    public async getMeta(platform: string, musicId: string): Promise<IMediaMeta | null> {
        const key = compositeKey(platform, musicId);
        const cached = this.cache.get(key);
        if (cached) return cached;

        const meta = await mod.getMeta(platform, musicId);
        if (meta) this.cache.set(key, meta);
        return meta;
    }

    /** 批量预加载到缓存 */
    public async preload(keys: Array<{ platform: string; id: string }>): Promise<void> {
        const uncached = keys.filter((k) => !this.cache.has(compositeKey(k.platform, k.id)));
        if (uncached.length === 0) return;

        const batchKeys = uncached.map((k) => ({ platform: k.platform, musicId: k.id }));
        const entries = await mod.batchGetMeta(batchKeys);
        for (const [key, meta] of entries) {
            this.cache.set(key, meta);
        }
    }

    /** 写入（IPC + 缓存更新由 onMetaChanged 事件驱动） */
    public async setMeta(platform: string, musicId: string, patch: MediaMetaPatch): Promise<void> {
        await mod.setMeta(platform, musicId, patch);
    }

    /** 删除 */
    public async deleteMeta(platform: string, musicId: string): Promise<void> {
        await mod.deleteMeta(platform, musicId);
    }

    /** 按字段查询 */
    public async queryByField(
        field: string,
    ): Promise<Array<{ platform: string; musicId: string; meta: IMediaMeta }>> {
        return mod.queryByField(field);
    }
}

// ─── 模块单例 ───

const mediaMeta = new MediaMetaRenderer();
export default mediaMeta;
