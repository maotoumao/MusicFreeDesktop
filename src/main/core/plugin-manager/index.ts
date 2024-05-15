import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import { Plugin } from "./plugin";
import {
  ipcMainHandle,
  ipcMainOn,
  ipcMainSendMainWindow,
} from "@/shared/ipc/main";
import { localPluginHash, localPluginName } from "@/common/constant";
import localPlugin from "./local-plugin";
import { rimraf } from "rimraf";
import _axios from "axios";
import { compare } from "compare-versions";
import { nanoid } from "nanoid";
import { addRandomHash } from "@/common/normalize-util";
import { getAppConfigPathSync } from "@/shared/app-config/main";
import https from "https";

const axios = _axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

let plugins: Plugin[] = [];
let clonedPlugins: IPlugin.IPluginDelegate[] = [];

let _pluginBasePath: string;
function getPluginBasePath() {
  if (_pluginBasePath) {
    return _pluginBasePath;
  }
  _pluginBasePath = path.resolve(
    app.getPath("userData"),
    "./musicfree-plugins"
  );
  return _pluginBasePath;
}

async function checkPath() {
  const pluginBasePath = getPluginBasePath();

  // 路径:
  try {
    const res = await fs.stat(pluginBasePath);
    if (!res.isDirectory()) {
      await rimraf(pluginBasePath);
      throw new Error();
    }
  } catch {
    fs.mkdir(pluginBasePath, {
      recursive: true,
    });
  }
}

function setPlugins(newPlugins: Plugin[]) {
  plugins = newPlugins;
  clonedPlugins = plugins.map((p) => {
    const sPlugin: IPlugin.IPluginDelegate = {} as any;
    sPlugin.supportedMethod = [];
    for (const k in p.instance) {
      // @ts-ignore
      if (typeof p.instance[k] === "function") {
        sPlugin.supportedMethod.push(k);
      } else {
        // @ts-ignore
        sPlugin[k] = p.instance[k];
      }
    }
    sPlugin.hash = p.hash;
    sPlugin.path = p.path;
    return JSON.parse(JSON.stringify(sPlugin));
  });
}

export async function setupPluginManager() {
  registerEvents();
  await checkPath();
  await loadAllPlugins();
}

export function getPluginByMedia(mediaItem: IMedia.IMediaBase) {
  return plugins.find((item) => item.instance.platform === mediaItem.platform);
}

/** 注册事件 */
function registerEvents() {
  /** 调用插件方法 */
  ipcMainHandle("call-plugin-method", callPluginMethod);

  /** 获取插件 */
  ipcMainHandle("get-all-plugins", () => clonedPlugins);
  ipcMainHandle("uninstall-plugin", async (hash) => {
    await uninstallPlugin(hash);
    sendPlugins();
  });

  /** 刷新插件 */
  ipcMainOn("refresh-plugins", loadAllPlugins);
  /** 更新所有插件 */
  ipcMainOn("update-all-plugins", updateAllPlugins);

  ipcMainHandle("install-plugin-remote", async (urlLike: string) => {
    try {
      const url = urlLike.trim();
      if (url.endsWith(".js")) {
        await installPluginFromUrl(addRandomHash(url));
      } else if (url.endsWith(".json")) {
        const jsonFile = (await axios.get(addRandomHash(url))).data;

        for (const cfg of jsonFile?.plugins ?? []) {
          await installPluginFromUrl(addRandomHash(cfg.url));
        }
      }
    } catch (e) {
      throw e;
    } finally {
      sendPlugins();
    }
  });
  ipcMainHandle("install-plugin-local", async (urlLike: string) => {
    try {
      const url = urlLike.trim();
      if (url.endsWith(".js")) {
        const rawCode = await fs.readFile(url, "utf8");
        await installPluginFromRawCode(rawCode);
      } else if (url.endsWith(".json")) {
        const jsonFile = JSON.parse(await fs.readFile(url, "utf8"));

        for (const cfg of jsonFile?.plugins ?? []) {
          await installPluginFromUrl(addRandomHash(cfg.url));
        }
      }
    } catch (e) {
      throw e;
    } finally {
      sendPlugins();
    }
  });
}

interface ICallPluginMethodParams<
  T extends keyof IPlugin.IPluginInstanceMethods
> {
  hash: string;
  platform: string;
  method: T;
  args: Parameters<IPlugin.IPluginInstanceMethods[T]>;
}

/** 调用插件方法 */
function callPluginMethod({
  hash,
  platform,
  method,
  args,
}: ICallPluginMethodParams<keyof IPlugin.IPluginInstanceMethods>) {
  let plugin: Plugin;
  if (hash === localPluginHash || platform === localPluginName) {
    plugin = localPlugin;
  } else if (hash) {
    plugin = plugins.find((item) => item.hash === hash);
  } else if (platform) {
    plugin = plugins.find((item) => item.name === platform);
  }
  if (!plugin) {
    return null;
  }
  const result = plugin.methods[method]?.apply?.({ plugin }, args);
  console.log(plugin, method, args);
  return result;
}

/** 加载所有插件 */
export async function loadAllPlugins() {
  const pluginBasePath = getPluginBasePath();
  const rawPluginNames = await fs.readdir(pluginBasePath);
  const pluginHashSet = new Set<string>();
  const _plugins: Plugin[] = [];
  for (let i = 0; i < rawPluginNames.length; ++i) {
    try {
      const pluginPath = path.resolve(pluginBasePath, rawPluginNames[i]);
      const filestat = await fs.stat(pluginPath);
      if (filestat.isFile() && path.extname(pluginPath) === ".js") {
        const funcCode = await fs.readFile(pluginPath, "utf-8");
        const plugin = new Plugin(funcCode, pluginPath);
        if (pluginHashSet.has(plugin.hash)) {
          continue;
        }
        if (plugin.hash !== "") {
          pluginHashSet.add(plugin.hash);
          _plugins.push(plugin);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
  setPlugins(_plugins);

  sendPlugins();
}

export function sendPlugins() {
  ipcMainSendMainWindow("plugin-loaded", clonedPlugins);
}

export async function installPluginFromUrl(url: string) {
  try {
    const funcCode = (await axios.get(url)).data;
    if (funcCode) {
      await installPluginFromRawCode(funcCode);
    }
  } catch (e: any) {
    throw new Error(e?.message ?? "");
  }
}

async function installPluginFromRawCode(funcCode: string) {
  const pluginBasePath = getPluginBasePath();
  const plugin = new Plugin(funcCode, "");
  const _pluginIndex = plugins.findIndex((p) => p.hash === plugin.hash);
  if (_pluginIndex !== -1) {
    // 静默忽略
    return;
  }
  const oldVersionPlugin = plugins.find((p) => p.name === plugin.name);
  if (
    oldVersionPlugin &&
    !getAppConfigPathSync("plugin.notCheckPluginVersion")
  ) {
    if (
      compare(
        oldVersionPlugin.instance.version ?? "",
        plugin.instance.version ?? "",
        ">"
      )
    ) {
      throw new Error("已安装更新版本的插件");
    }
  }

  if (plugin.hash !== "") {
    const fn = nanoid();
    const _pluginPath = path.resolve(pluginBasePath, `${fn}.js`);
    await fs.writeFile(_pluginPath, funcCode, "utf8");
    plugin.path = _pluginPath;
    let newPlugins = plugins.concat(plugin);
    if (oldVersionPlugin) {
      newPlugins = newPlugins.filter((_) => _.hash !== oldVersionPlugin.hash);
      try {
        await rimraf(oldVersionPlugin.path);
      } catch {}
    }
    setPlugins(newPlugins);
    return;
  }
  throw new Error("插件无法解析!");
}

/** 卸载插件 */
async function uninstallPlugin(hash: string) {
  const targetIndex = plugins.findIndex((_) => _.hash === hash);
  if (targetIndex !== -1) {
    try {
      await rimraf(plugins[targetIndex].path);
      const newPlugins = plugins.filter((_) => _.hash !== hash);
      setPlugins(newPlugins);
    } catch {}
  }
}

/** 更新所有插件 */
async function updateAllPlugins() {
  return Promise.allSettled(
    plugins.map((plg) =>
      plg.instance.srcUrl ? installPluginFromUrl(plg.instance.srcUrl) : null
    )
  );
}
