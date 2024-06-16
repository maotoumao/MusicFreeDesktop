import { app } from "electron";
import fs from "fs/promises";
import { rimraf } from "rimraf";
import path from "path";
import { IAppConfig, IAppConfigKeyPath, IAppConfigKeyPathValue } from "./type";
import { produce } from "immer";
import objectPath from "object-path";
import { ipcMainHandle, ipcMainSend } from "@/shared/ipc/main";
import { getLyricWindow, getMainWindow } from "@/main/window";
import defaultAppConfig from "./internal/default-app-config";

let _configPath: string;

function getConfigPath() {
  if (!_configPath) {
    _configPath = path.resolve(app.getPath("userData"), "config.json");
  }
  return _configPath;
}

let cacheConfig: IAppConfig = null;

async function checkPath() {
  // 路径:
  const configDirPath = app.getPath("userData");
  try {
    const res = await fs.stat(configDirPath);
    if (!res.isDirectory()) {
      await rimraf(configDirPath);
      throw new Error();
    }
  } catch {
    fs.mkdir(configDirPath, {
      recursive: true,
    });
  }

  try {
    const res = await fs.stat(getConfigPath());
    if (!res.isFile()) {
      await rimraf(getConfigPath());
      throw new Error();
    }
  } catch {
    fs.writeFile(getConfigPath(), "{}", "utf-8");
    cacheConfig = {};
  }
}

export async function setupMainAppConfig() {
  await checkPath();
  await getAppConfig();
  ipcMainHandle("sync-app-config", () => {
    return getAppConfig();
  });

  ipcMainHandle("set-app-config", (config) => {
    return setAppConfig(config);
  });

  ipcMainHandle("set-app-config-path", ({ keyPath, value }) => {
    return setAppConfigPath(keyPath, value);
  });
}

export async function getAppConfig(): Promise<IAppConfig> {
  try {
    if (cacheConfig) {
      return cacheConfig;
    } else {
      const rawConfig = await fs.readFile(getConfigPath(), "utf8");
      const rawJson = JSON.parse(rawConfig);
      cacheConfig = rawJson;
    }
  } catch (e) {
    if (e.message === "Unexpected end of JSON input" || e.code === "EISDIR") {
      // JSON 解析异常 / 非文件
      await rimraf(getConfigPath());
      await checkPath();
    } else if (e.code === "ENOENT") {
      // 文件不存在
      await checkPath();
    }
    cacheConfig = {};
  }
  return cacheConfig;
}

export async function setAppConfig(
  appConfig: IAppConfig,
  retryTime = 1
): Promise<boolean> {
  const mainWindow = getMainWindow();
  const lyricWindow = getLyricWindow();

  try {
    const rawConfig = JSON.stringify(appConfig, undefined, 4);
    await fs.writeFile(getConfigPath(), rawConfig, "utf8");
    cacheConfig = appConfig;
    ipcMainSend(mainWindow, "sync-app-config", cacheConfig);
    if (lyricWindow) {
      // 没必要全部同步
      ipcMainSend(lyricWindow, "sync-app-config", {
        lyric: cacheConfig.lyric,
      });
    }
    return true;
  } catch (e) {
    console.log("SET CONFIG FAIL", e);
    if (retryTime > 0) {
      if (e.code === "EISDIR") {
        // 非文件
        await rimraf(getConfigPath());
        await checkPath();
        return setAppConfig(appConfig, retryTime - 1);
      }
    }
    ipcMainSend(mainWindow, "sync-app-config", cacheConfig);
    if (lyricWindow) {
      ipcMainSend(lyricWindow, "sync-app-config", {
        lyric: cacheConfig.lyric,
      });
    }
    return false;
  }
}

export async function setAppConfigPath<K extends IAppConfigKeyPath>(
  keyPath: K,
  value: IAppConfigKeyPathValue<K>
): Promise<boolean> {
  const newConfig = produce(cacheConfig, (draft) => {
    objectPath.set(draft, keyPath, value);
  });

  return setAppConfig(newConfig);
}

export async function getAppConfigPath<K extends IAppConfigKeyPath>(
  keyPath: K
): Promise<IAppConfigKeyPathValue<K> | undefined> {
  const config = await getAppConfig();
  return objectPath.get(config, keyPath) ?? defaultAppConfig[keyPath];
}

export function getAppConfigPathSync<K extends IAppConfigKeyPath>(
  keyPath: K
): IAppConfigKeyPathValue<K> | undefined {
  if (!cacheConfig) {
    return null;
  }
  return objectPath.get(cacheConfig, keyPath) ?? defaultAppConfig[keyPath];
}
