import CryptoJs from "crypto-js";
import dayjs from "dayjs";
import axios from "axios";
import bigInt from "big-integer";
import qs from "qs";
import * as cheerio from "cheerio";
import he from "he";
import PluginMethods from "./plugin-methods";
import reactNativeCookies from "./polyfill/react-native-cookies";
import { getAppConfigPathSync } from "@/shared/app-config/main";
import { app } from "electron";
import * as webdav from "webdav";

axios.defaults.timeout = 15000;

const sha256 = CryptoJs.SHA256;

export enum PluginStateCode {
  /** 版本不匹配 */
  VersionNotMatch = "VERSION NOT MATCH",
  /** 无法解析 */
  CannotParse = "CANNOT PARSE",
}

const packages: Record<string, any> = {
  cheerio,
  "crypto-js": CryptoJs,
  axios,
  dayjs,
  "big-integer": bigInt,
  qs,
  he,
  "@react-native-cookies/cookies": reactNativeCookies,
  webdav,
};

const _require = (packageName: string) => {
  const pkg = packages[packageName];
  pkg.default = pkg;
  return pkg;
};

// const _consoleBind = function (
//     method: 'log' | 'error' | 'info' | 'warn',
//     ...args: any
// ) {
//     const fn = console[method];
//     if (fn) {
//         fn(...args);
//         devLog(method, ...args);
//     }
// };

// const _console = {
//     log: _consoleBind.bind(null, 'log'),
//     warn: _consoleBind.bind(null, 'warn'),
//     info: _consoleBind.bind(null, 'info'),
//     error: _consoleBind.bind(null, 'error'),
// };

//#region 插件类
export class Plugin {
  /** 插件名 */
  public name: string;
  /** 插件的hash，作为唯一id */
  public hash: string;
  /** 插件状态信息 */
  public stateCode?: PluginStateCode;
  /** 插件的实例 */
  public instance: IPlugin.IPluginInstance;
  /** 插件路径 */
  public path: string;
  /** 插件方法 */
  public methods: PluginMethods;

  constructor(
    funcCode: string | (() => IPlugin.IPluginInstance),
    pluginPath: string
  ) {
    let _instance: IPlugin.IPluginInstance;
    const _module: any = { exports: {} };
    try {
      if (typeof funcCode === "string") {
        // 插件的环境变量
        const env = {
          getUserVariables: () => {
            return (
              getAppConfigPathSync("private.pluginMeta")?.[this.name]
                ?.userVariables ?? {}
            );
          },
          os: process.platform,
          appVersion: app.getVersion(),
          lang: getAppConfigPathSync("normal.language"),
        };
        const _process = {
          platform: process.platform,
          version: app.getVersion(),
          env,
        };
        // eslint-disable-next-line no-new-func
        _instance = Function(`
                    'use strict';
                    return function(require, __musicfree_require, module, exports, console, env, process) {
                        ${funcCode}
                    }
                `)()(
          _require,
          _require,
          _module,
          _module.exports,
          console,
          env,
          _process
        );
        if (_module.exports.default) {
          _instance = _module.exports.default as IPlugin.IPluginInstance;
        } else {
          _instance = _module.exports as IPlugin.IPluginInstance;
        }
      } else {
        _instance = funcCode();
      }
      // 插件初始化后的一些操作
      if (Array.isArray(_instance.userVariables)) {
        _instance.userVariables = _instance.userVariables.filter(
          (it) => it?.key
        );
      }
      this.checkValid(_instance);
    } catch (e: any) {
      console.log(e);
      this.stateCode = PluginStateCode.CannotParse;
      if (e?.stateCode) {
        this.stateCode = e.stateCode;
      }

      _instance = e?.instance ?? {
        _path: "",
        platform: "",
        appVersion: "",
        async getMediaSource() {
          return null;
        },
        async search() {
          return {};
        },
        async getAlbumInfo() {
          return null;
        },
      };
    }
    this.instance = _instance;
    this.path = pluginPath;
    this.name = _instance.platform;
    if (this.instance.platform === "" || this.instance.platform === undefined) {
      this.hash = "";
    } else {
      if (typeof funcCode === "string") {
        this.hash = sha256(funcCode).toString();
      } else {
        this.hash = sha256(funcCode.toString()).toString();
      }
    }

    // 放在最后
    this.methods = new PluginMethods(this);
  }

  private checkValid(_instance: IPlugin.IPluginInstance) {
    /** 版本号校验 */
    // if (
    //     _instance.appVersion &&
    //     !satisfies(DeviceInfo.getVersion(), _instance.appVersion)
    // ) {
    //     throw {
    //         instance: _instance,
    //         stateCode: PluginStateCode.VersionNotMatch,
    //     };
    // }
    return true;
  }
}
//#endregion
