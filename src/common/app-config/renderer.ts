import objectPath from "object-path";
import {
  ipcRendererInvoke,
  ipcRendererOn,
} from "../ipc-util/renderer";
import Store from "../store";
import { IAppConfig, IAppConfigKeyPath, IAppConfigKeyPathValue } from "./type";

const appConfigStore = new Store({});

async function setupRendererAppConfig() {
  ipcRendererOn("sync-app-config", (config) => {
    appConfigStore.setValue(config);
  });

  const appConfig = await ipcRendererInvoke("sync-app-config", undefined);
  appConfigStore.setValue(appConfig);
}

function getAppConfigPath<K extends IAppConfigKeyPath>(
  keyPath: K
): IAppConfigKeyPathValue<K> {
  const value = appConfigStore.getValue();
  return objectPath.get(value, keyPath);
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

async function setAppConfig(appConfig: IAppConfig) {
  return ipcRendererInvoke("set-app-config", appConfig);
}

const getAppConfig = appConfigStore.getValue;
const useAppConfig = appConfigStore.useValue;


const rendererAppConfig = {
    setupRendererAppConfig,
    getAppConfig,
    getAppConfigPath,
    useAppConfig,
    setAppConfig,
    setAppConfigPath
}

export default rendererAppConfig;