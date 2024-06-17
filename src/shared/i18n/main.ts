import { app, ipcMain } from "electron";
import path from "path";
import fs from "fs/promises";
import i18n from "i18next";

const ns = "translation";

const resPath = app.isPackaged
  ? path.resolve(process.resourcesPath, "res")
  : path.resolve(__dirname, "../../res");

export const getResPath = (resourceName: string) => {
  return path.resolve(resPath, resourceName);
};

let allLangs: string[] = [];

async function readLangContent(
  langCode: string,
  enableRedirect = true
): Promise<object | null> {
  const langPath = path.resolve(getResPath(`./lang/${langCode}.json`));
  try {
    const content = await fs.readFile(langPath, "utf8");
    const jsonObj = JSON.parse(content);
    if (jsonObj["$alias"] && enableRedirect) {
      return readLangContent(jsonObj["$alias"], false);
    }
    return jsonObj;
  } catch {
    return null;
  }
}

interface ISetupI18nOptions {
  getDefaultLang?: () => string | null;
  onLanguageChanged?: (lang: string) => void;
}

export async function setupI18n(options?: ISetupI18nOptions) {
  const { getDefaultLang, onLanguageChanged } = options || {};

  const basicDir = getResPath("./lang");
  try {
    await i18n.init({
      resources: {},
    });

    const dirContents = await fs.readdir(basicDir, {
      withFileTypes: true,
    });

    allLangs = dirContents
      .filter((it) => it.isFile() && it.name.endsWith(".json"))
      .map((it) => it.name.slice(0, -5));

    let defaultLang = getDefaultLang?.();
    if (defaultLang && !allLangs.includes(defaultLang)) {
      defaultLang = undefined;
    }

    if (!defaultLang) {
      const appLocale = app.getLocale();
      if (allLangs.includes(appLocale)) {
        defaultLang = appLocale;
      } else if (appLocale.includes("zh") && allLangs.includes("zh-CN")) {
        defaultLang = "zh-CN";
      } else if (allLangs.includes("en-US")) {
        defaultLang = "en-US";
      } else {
        defaultLang = allLangs[0];
      }
    }

    const langContent = await readLangContent(defaultLang);
    if (defaultLang && langContent) {
      i18n.addResourceBundle(defaultLang, ns, langContent);
      i18n.changeLanguage(defaultLang);
    }

    ipcMain.handle("shared/i18n/setup", async () => {
      const currentLang = i18n.language;
      const langContent = await readLangContent(currentLang);
      if (langContent) {
        return {
          lang: currentLang,
          content: langContent,
          allLangs,
        };
      }
      return null;
    });

    ipcMain.handle("shared/i18n/changeLang", async (_, lang: string) => {
      if (i18n.hasResourceBundle(lang, ns)) {
        await i18n.changeLanguage(lang);
        onLanguageChanged?.(lang);
        return {
          lang,
          content: i18n.getResourceBundle(lang, ns),
        };
      } else {
        const langContent = await readLangContent(lang);
        if (langContent) {
          i18n.addResourceBundle(lang, ns, langContent);
          await i18n.changeLanguage(lang);
          onLanguageChanged?.(lang);
          return {
            lang,
            content: langContent,
          };
        }
      }

      return null;
    });
  } catch {}
}

export const t = i18n.t.bind(i18n);

export default {
  setup: setupI18n,
  t: i18n.t,
};
