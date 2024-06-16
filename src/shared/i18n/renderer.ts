import i18n from "i18next";
import Store from "@/common/store";
import { initReactI18next } from "react-i18next";
import { IMod } from "./type";

i18n.use(initReactI18next);

const ns = "translation";

const langListStore = new Store<string[]>([]);

const mod = window["@shared/i18n" as any] as unknown as IMod;

export async function setupI18n() {
  const { allLangs = [], content, lang } = (await mod.setupLang()) || {};
  langListStore.setValue(allLangs);
  await i18n.init({
    resources: {
        [lang]: {
            [ns]: content
        }
    },
    lng: lang
  })
}

export async function changeLang(lang: string): Promise<boolean> {
  const langData = await mod.changeLang(lang);
  if (!langData) {
    return false;
  }
  if (i18n.hasResourceBundle(lang, ns)) {
    await i18n.changeLanguage(lang);
  } else {
    i18n.addResourceBundle(lang, ns, langData.content);
    await i18n.changeLanguage(lang);
  }
  return true;
}

export const useLangList = langListStore.useValue;

export const getLangList = langListStore.getValue;

export const isCN = () => i18n.language.includes("zh-CN");

export {i18n};


export default {
  setupI18n,
  changeLang,
  useLangList,
  getLangList,
  i18n
};

