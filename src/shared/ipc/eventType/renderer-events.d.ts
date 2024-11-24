declare namespace IpcEvents {
  // 由 Renderer 发出的ipc通信

  interface Renderer {
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
  
}
