declare namespace IpcEvents {
  // 由 Renderer 发出的ipc通信

  interface Renderer {
    /** 刷新插件 */
    "refresh-plugins": undefined;
    /** 更新所有插件 */
    "update-all-plugins": undefined;

    // "send-to-lyric-window": {
    //   // 时序
    //   timeStamp: number;
    //   lrc: ILyric.IParsedLrcItem[];
    // };


    /** 快捷键 */
    "enable-global-short-cut": boolean;
    "bind-global-short-cut": {
      key: keyof import("@/types/app-config").IAppConfig["shortCut.shortcuts"];
      shortCut: string[];
    };
    "unbind-global-short-cut": {
      key: keyof import("@/types/app-config").IAppConfig["shortCut.shortcuts"];
      shortCut: string[];
    };
  }
}

/** 需要回执 */
declare namespace IpcInvoke {
  type IAppConfig = import("@/shared/app-config/type").IAppConfig;

  interface Renderer {
    "get-all-plugins": () => IPlugin.IPluginDelegate[];
    "call-plugin-method": <
      T extends keyof IPlugin.IPluginInstanceMethods
    >(arg: {
      // 通过hash或者platform查找插件
      hash?: string;
      platform?: string;
      // 方法
      method: T;
      // 参数
      args: Parameters<IPlugin.IPluginInstanceMethods[T]>;
    }) => ReturnType<IPlugin.IPluginInstanceMethods[T]>;
    "install-plugin-remote": (url: string) => void;
    "install-plugin-local": (url: string) => void;
    "uninstall-plugin": (pluginhash: string) => void;
  }
}
