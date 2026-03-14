/**
 * i18n — 渲染进程层
 *
 * 职责：
 * - 初始化渲染进程侧 i18next 实例（react-i18next 集成）
 * - 通过 IPC 获取语言数据并切换语言
 * - 提供 React Hook（useLangNames）
 */
import { createInstance } from 'i18next';
import { atom, getDefaultStore } from 'jotai';
import { useAtomValue } from 'jotai/react';
import { initReactI18next } from 'react-i18next';
import type { ILanguageContent, ILanguageContentWithAllLangs } from '@appTypes/infra/i18n';
import { CONTEXT_BRIDGE_KEY } from './common/constant';

const i18nInstance = createInstance();
i18nInstance.use(initReactI18next);

const ns = 'translation';
const langNamesAtom = atom<string[]>([]);
const defaultAtomStore = getDefaultStore();

interface IMod {
    setupLanguage(): Promise<ILanguageContentWithAllLangs | null>;
    changeLanguage(lang: string): Promise<ILanguageContent | null>;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

class I18n {
    public readonly t = i18nInstance.t.bind(i18nInstance);

    public async setup() {
        const { allLangs = [], content, lang } = (await mod.setupLanguage()) || {};
        defaultAtomStore.set(langNamesAtom, allLangs);
        if (!lang || !content) {
            return;
        }

        await i18nInstance.init({
            resources: {
                [lang]: {
                    [ns]: content,
                },
            },
            lng: lang,
        });
    }

    public async changeLanguage(lang: string): Promise<boolean> {
        const langData = await mod.changeLanguage(lang);
        if (!langData) {
            return false;
        }

        if (i18nInstance.hasResourceBundle(lang, ns)) {
            await i18nInstance.changeLanguage(lang);
        } else {
            i18nInstance.addResourceBundle(lang, ns, langData.content);
            await i18nInstance.changeLanguage(lang);
        }

        return true;
    }

    public getLangNames() {
        return defaultAtomStore.get(langNamesAtom);
    }

    public isCN() {
        return i18nInstance.language.includes('zh-CN');
    }
}

const i18n = new I18n();

export function useLangNames() {
    return useAtomValue(langNamesAtom);
}

export default i18n;
