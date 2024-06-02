import Store from "@/common/store";
import type { IMod } from "./type";
import { toast } from "react-toastify";
import { useEffect } from "react";

const mod = window["@shared/themepack" as any] as unknown as IMod;

// 所有本地主题包
const localThemePacksStore = new Store<Array<ICommon.IThemePack | null>>([]);
// 当前选中的主题包
const currentThemePackStore = new Store<ICommon.IThemePack | null>(null);

async function selectTheme(themePack: ICommon.IThemePack | null) {
  if (!themePack?.hash) {
    themePack = null;
  }
  await mod.selectTheme(themePack);
  currentThemePackStore.setValue(themePack);
}

let themePacksLoaded = false;
async function setupThemePacks() {
  try {
    const currentTheme = await mod.initCurrentTheme();
    // 选中主题
    await selectTheme(currentTheme);
    // 调度
    requestIdleCallback(() => {
      if (!themePacksLoaded) {
        mod.loadThemePacks();
      }
    });
  } catch {}
}

async function loadThemePacks() {
  themePacksLoaded = true;

  const themePacks = await mod.loadThemePacks();
  localThemePacksStore.setValue(themePacks);
}

async function installThemePack(themePackPath: string) {
  const themePackConfig = await mod.installThemePack(themePackPath);
  if (themePackConfig) {
    localThemePacksStore.setValue((prev) => [...prev, themePackConfig]);
  }
  return themePackConfig;
}

async function installRemoteThemePack(remoteUrl: string) {
  const themePackConfig = await mod.installRemoteThemePack(remoteUrl);
  if (themePackConfig) {
    localThemePacksStore.setValue((prev) => [...prev, themePackConfig]);
  }
  return themePackConfig;
}

async function uninstallThemePack(themePack: ICommon.IThemePack) {
  try {
    await mod.uninstallThemePack(themePack);
    localThemePacksStore.setValue((prev) =>
      prev.filter((it) => it?.path !== themePack.path)
    );
    if (currentThemePackStore.getValue()?.path === themePack.path) {
      selectTheme(null);
    }
  } catch {
    toast.error("卸载失败");
  }
}

function useLocalThemePacks() {
  const val = localThemePacksStore.useValue();

  useEffect(() => {
    if (!themePacksLoaded) {
      loadThemePacks();
    }
  }, []);

  return val;
}

const ThemePack = {
  selectTheme,
  setupThemePacks,
  loadThemePacks,
  installThemePack,
  installRemoteThemePack,
  uninstallThemePack,
  replaceAlias: mod.replaceAlias,
  useLocalThemePacks,
  useCurrentThemePack: currentThemePackStore.useValue,
};

export default ThemePack;
