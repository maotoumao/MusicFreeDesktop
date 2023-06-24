import { app } from "electron";
import fs from "fs/promises";
import { rimraf } from "rimraf";
import path from "path";
import { IAppConfig, IAppConfigKeyPath, IAppConfigKeyPathValue } from "./type";
import { produce } from "immer";
import objectPath from "object-path";
import { ipcMainHandle, ipcMainSend } from "../ipc-util/main";
import { getMainWindow } from "@/main/window";

const configDirPath = app.getPath("userData");
// 所有的配置操作由主进程完成
const configPath = path.resolve(configDirPath, "config.json");


let cacheConfig: IAppConfig = null;

async function checkPath() {
  // 路径:
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
    const res = await fs.stat(configPath);
    if (!res.isFile()) {
      await rimraf(configPath);
      throw new Error();
    }
  } catch {
    fs.writeFile(configPath, "{}", "utf-8");
    cacheConfig = {};
  }
}

export async function setupMainAppConfig() {
  await checkPath();
  ipcMainHandle('sync-app-config', () => {
    return getAppConfig();
  })

  ipcMainHandle('set-app-config', (config) => {
    return setAppConfig(config);
  })

  ipcMainHandle('set-app-config-path', ({
    keyPath,
    value
  }) => {
    return setAppConfigPath(keyPath, value);
  })

}

export async function getAppConfig(): Promise<IAppConfig> {
  try {
    if (cacheConfig) {
      return cacheConfig;
    } else {
      const rawConfig = await fs.readFile(configPath, "utf8");
      const rawJson = JSON.parse(rawConfig);
      cacheConfig = rawJson;
    }
  } catch (e) {
    if (e.message === "Unexpected end of JSON input" || e.code === "EISDIR") {
      // JSON 解析异常 / 非文件
      await rimraf(configPath);
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

  try {
    const rawConfig = JSON.stringify(appConfig, undefined, 4);
    await fs.writeFile(configPath, rawConfig, "utf8");
    cacheConfig = appConfig;
    ipcMainSend(mainWindow, "sync-app-config", cacheConfig);
    return true;
  } catch (e) {
    if (retryTime > 0) {
      if (e.code === "EISDIR") {
        // 非文件
        await rimraf(configPath);
        await checkPath();
        return setAppConfig(appConfig, retryTime - 1);
      }
    }
    ipcMainSend(mainWindow, "sync-app-config", cacheConfig);
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
  const config = getAppConfig();
  return objectPath.get(config, keyPath);
}
