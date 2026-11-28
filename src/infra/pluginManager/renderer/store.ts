/**
 * pluginManager — Renderer jotai Store
 *
 * 集中管理插件状态的 jotai atom 和 store 实例。
 * index.ts（命令式 API）和 hooks.ts（React Hook）均从此文件导入。
 */

import { atom, getDefaultStore } from 'jotai';
import type { IPluginMetaAll } from '@appTypes/infra/pluginManager';

export const store = getDefaultStore();

// ─── Atoms ───

/** 插件 delegate 列表 */
export const pluginsAtom = atom<IPlugin.IPluginDelegate[]>([]);

/** 全量插件 meta（排序、启用状态、用户变量等） */
export const pluginMetaAtom = atom<IPluginMetaAll>({});
