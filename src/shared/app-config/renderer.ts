import objectPath from "object-path";
import { ipcRendererInvoke, ipcRendererOn } from "@/shared/ipc/renderer";
import Store from "../../common/store";
import { IAppConfig, IAppConfigKeyPath, IAppConfigKeyPathValue } from "./type";
import defaultAppConfig from "./internal/default-app-config";

const appConfigStore = new Store<IAppConfig>({});

export async function setupRendererAppConfig() {
  ipcRendererOn("sync-app-config", (config) => {
    appConfigStore.setValue(config);
  });

  const appConfig = await ipcRendererInvoke("sync-app-config", undefined);
  appConfigStore.setValue(appConfig);
}

export function getAppConfigPath<K extends IAppConfigKeyPath>(
  keyPath: K
): IAppConfigKeyPathValue<K> {
  const value = appConfigStore.getValue();
  return objectPath.get(value, keyPath) ?? defaultAppConfig[keyPath];
}

export async function setAppConfigPath<K extends IAppConfigKeyPath>(
  keyPath: K,
  value: IAppConfigKeyPathValue<K>
): Promise<boolean> {
  return ipcRendererInvoke("set-app-config-path", {
    keyPath,
    value,
  });
}

export async function setAppConfig(appConfig: IAppConfig) {
  return ipcRendererInvoke("set-app-config", appConfig);
}

export const getAppConfig = appConfigStore.getValue;
export const useAppConfig = appConfigStore.useValue;
