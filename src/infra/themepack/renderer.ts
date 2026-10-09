/**
 * themepack — 渲染进程层
 *
 * 对外提供极简 API 和 React Hooks。
 * 所有 localStorage 缓存、DOM 操作、文件 I/O 等细节隐藏在 preload 层。
 *
 * 调用方只需：
 *   - `themePack.setup()` 初始化（一次）
 *   - `themePack.selectTheme(pack)` 切换主题
 *   - `themePack.useCurrentThemePack()` 在 React 中消费当前主题
 *   - `themePack.useInstalledThemePacks()` 在 React 中消费主题列表
 */
import { useEffect } from 'react';
import { atom, getDefaultStore } from 'jotai';
import { useAtomValue } from 'jotai/react';

import type { IThemePack } from '@appTypes/infra/themepack';
import { CONTEXT_BRIDGE_KEY } from './common/constant';

// ─── Preload Bridge ───

/** preload 暴露的 API 接口契约 */
interface IMod {
    initCurrentTheme(): Promise<IThemePack | null>;
    selectTheme(themePack: IThemePack | null): Promise<void>;
    loadAllThemePacks(): Promise<IThemePack[]>;
    installThemePack(mfthemePath: string): Promise<IThemePack | null>;
    installRemoteThemePack(remoteUrl: string): Promise<IThemePack | null>;
    uninstallThemePack(themePack: IThemePack): Promise<void>;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── State (Jotai) ───

const defaultStore = getDefaultStore();

/** 当前选中的主题包 */
const currentThemePackAtom = atom(null as IThemePack | null);

/** 所有已安装的主题包列表 */
const allThemePacksAtom = atom([] as IThemePack[]);

// ─── 模块实现 ───

class ThemePackRenderer {
    /** 首次加载的去重 Promise，避免多个组件同时 mount 时触发多次磁盘扫描 */
    private initialLoadPromise: Promise<IThemePack[]> | null = null;
    /**
     * 初始化 ThemePack 模块。
     * 应在 React 应用入口调用一次。
     * 校验缓存有效性并加载 iframe。
     */
    public async setup(): Promise<void> {
        const themePack = await mod.initCurrentTheme();
        defaultStore.set(currentThemePackAtom, themePack);
    }

    /**
     * 切换主题。传入 null 清除当前主题。
     */
    public async selectTheme(themePack: IThemePack | null): Promise<void> {
        await mod.selectTheme(themePack);
        defaultStore.set(currentThemePackAtom, themePack);
    }

    /**
     * 安装本地 .mftheme 主题包文件。
     * @returns 安装成功的主题包元数据，失败返回 null
     */
    public async installThemePack(filePath: string): Promise<IThemePack | null> {
        const tp = await mod.installThemePack(filePath);
        if (tp) {
            defaultStore.set(allThemePacksAtom, (prev) => [...prev, tp]);
        }
        return tp;
    }

    /**
     * 下载并安装远程 .mftheme 主题包。
     * @param url 远程主题包 URL
     * @param replaceHash 如果提供，安装成功后卸载此 hash 对应的旧版本
     * @returns 安装成功的主题包元数据，失败返回 null
     */
    public async installRemoteThemePack(
        url: string,
        replaceHash?: string,
    ): Promise<IThemePack | null> {
        // 先安装新版本
        const tp = await mod.installRemoteThemePack(url);
        if (!tp) return null;

        // 安装成功后再卸载旧版本（避免下载失败时丢失旧主题）
        if (replaceHash) {
            const old = defaultStore.get(allThemePacksAtom).find((t) => t.hash === replaceHash);
            if (old) {
                if (old.builtin) {
                    // 内置主题不可卸载，直接追加新版本
                    defaultStore.set(allThemePacksAtom, (prev) => [...prev, tp]);
                } else {
                    try {
                        await mod.uninstallThemePack(old);
                        // 乐观更新：移除旧版本、追加新版本
                        defaultStore.set(allThemePacksAtom, (prev) => [
                            ...prev.filter((t) => t.path !== old.path),
                            tp,
                        ]);
                        // 如果替换的是当前活动主题，切换到新版本
                        const current = defaultStore.get(currentThemePackAtom);
                        if (current?.path === old.path) {
                            await this.selectTheme(tp);
                        }
                    } catch {
                        // 卸载旧版本失败，回退到全量重载
                        await this.loadAllThemePacks();
                    }
                }
            } else {
                // 旧版本未找到（可能列表未加载），直接追加
                defaultStore.set(allThemePacksAtom, (prev) => [...prev, tp]);
            }
        } else {
            defaultStore.set(allThemePacksAtom, (prev) => [...prev, tp]);
        }

        return tp;
    }

    /**
     * 卸载主题包。
     * 如果卸载的是当前主题，自动清除。
     */
    public async uninstallThemePack(themePack: IThemePack): Promise<void> {
        if (themePack.builtin) return;
        await mod.uninstallThemePack(themePack);
        defaultStore.set(allThemePacksAtom, (prev) =>
            prev.filter((t) => t.path !== themePack.path),
        );
        // 如果卸载的是当前选中主题 → 清除
        const current = defaultStore.get(currentThemePackAtom);
        if (current?.path === themePack.path) {
            await this.selectTheme(null);
        }
    }

    /**
     * 从磁盘重新扫描并加载全部已安装主题包列表。
     */
    public async loadAllThemePacks(): Promise<IThemePack[]> {
        const list = await mod.loadAllThemePacks();
        // 内置主题已由 preload 排在前面，用户安装的按名称排序
        list.sort((a, b) => {
            // 内置主题始终排在最前面
            if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        defaultStore.set(allThemePacksAtom, list);
        // 刷新后清除首次加载缓存，下次 ensureLoaded 会重新加载
        this.initialLoadPromise = null;
        return list;
    }

    /**
     * 确保列表至少加载过一次。
     * 多次调用安全，首次触发实际加载，后续复用。
     */
    public ensureLoaded(): Promise<IThemePack[]> {
        if (!this.initialLoadPromise) {
            this.initialLoadPromise = this.loadAllThemePacks();
        }
        return this.initialLoadPromise;
    }
}

const themePack = new ThemePackRenderer();

// ─── React Hooks ───

/**
 * 消费当前选中的主题包。
 * 返回 IThemePack 或 null。
 */
export function useCurrentThemePack(): IThemePack | null {
    return useAtomValue(currentThemePackAtom);
}

/**
 * 消费全部已安装主题包列表。
 * 首次渲染时会自动触发加载。
 */
export function useInstalledThemePacks(): IThemePack[] {
    const packs = useAtomValue(allThemePacksAtom);

    useEffect(() => {
        themePack.ensureLoaded();
    }, []);

    return packs;
}

export default themePack;
