/**
 * pluginManager — 插件持久化存储
 *
 * 为每个插件提供独立的 KV 存储命名空间。
 * 数据保存在 userData/musicfree-plugin-storage/chunk.json 中。
 * 写入操作使用防抖（500ms），避免频繁磁盘 IO。
 * 文件大小上限 10MB，超出时拒绝写入。
 */

import fs from 'fs';
import path from 'path';
import {
    PLUGIN_STORAGE_DIR_NAME,
    PLUGIN_STORAGE_FILE_NAME,
    PLUGIN_STORAGE_MAX_SIZE,
} from '../common/constant';

/** 存储格式：{ [pluginHash]: { [key]: value } } */
type StorageData = Record<string, Record<string, string>>;

const DEBOUNCE_MS = 500;

export class PluginStorage {
    private data: StorageData = {};
    private filePath: string;
    private dirty = false;
    private writeTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(userDataPath: string) {
        const dir = path.join(userDataPath, PLUGIN_STORAGE_DIR_NAME);
        this.filePath = path.join(dir, PLUGIN_STORAGE_FILE_NAME);

        // 确保目录存在
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 同步加载现有数据
        this.loadSync();
    }

    /** 获取存储项 */
    getItem(pluginHash: string, key: string): string | null {
        return this.data[pluginHash]?.[key] ?? null;
    }

    /** 设置存储项 */
    setItem(pluginHash: string, key: string, value: string): void {
        if (!this.data[pluginHash]) {
            this.data[pluginHash] = {};
        }
        this.data[pluginHash][key] = value;
        this.scheduleSave();
    }

    /** 删除存储项 */
    removeItem(pluginHash: string, key: string): void {
        if (this.data[pluginHash]) {
            delete this.data[pluginHash][key];
            this.scheduleSave();
        }
    }

    /** 清除指定插件的所有存储 */
    clearPlugin(pluginHash: string): void {
        delete this.data[pluginHash];
        this.scheduleSave();
    }

    /** 立即写入（应用退出时调用） */
    flush(): void {
        if (this.writeTimer) {
            clearTimeout(this.writeTimer);
            this.writeTimer = null;
        }
        if (this.dirty) {
            this.saveSync();
        }
    }

    /** 同步加载数据 */
    private loadSync(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                this.data = JSON.parse(raw) ?? {};
            }
        } catch (err) {
            console.error('[PluginStorage] Failed to load storage:', err);
            this.data = {};
        }
    }

    /** 同步保存数据 */
    private saveSync(): void {
        try {
            const content = JSON.stringify(this.data);

            // 检查大小限制
            if (Buffer.byteLength(content, 'utf-8') > PLUGIN_STORAGE_MAX_SIZE) {
                console.error('[PluginStorage] Storage size exceeds 10MB limit, write rejected');
                return;
            }

            fs.writeFileSync(this.filePath, content, 'utf-8');
            this.dirty = false;
        } catch (err) {
            console.error('[PluginStorage] Failed to save storage:', err);
        }
    }

    /** 防抖保存 */
    private scheduleSave(): void {
        this.dirty = true;

        if (this.writeTimer) {
            clearTimeout(this.writeTimer);
        }

        this.writeTimer = setTimeout(() => {
            this.writeTimer = null;
            this.saveSync();
        }, DEBOUNCE_MS);
    }
}
