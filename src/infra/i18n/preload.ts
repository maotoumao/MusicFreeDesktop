/**
 * i18n — Preload 层
 *
 * 职责：纯桥接，通过 contextBridge 暴露语言初始化和切换接口。
 *
 * 暴露名称：'@infra/i18n'
 */
import type { ILanguageContent, ILanguageContentWithAllLangs } from '@appTypes/infra/i18n';
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = {
    setupLanguage: (): Promise<ILanguageContentWithAllLangs> => ipcRenderer.invoke(IPC.SETUP),

    changeLanguage: (lang: string): Promise<ILanguageContent> =>
        ipcRenderer.invoke(IPC.CHANGE_LANG, lang),
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
