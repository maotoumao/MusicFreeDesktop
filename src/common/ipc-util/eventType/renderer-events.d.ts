
declare namespace IpcEvents {
  // 由 Renderer 发出的ipc通信
  interface Renderer {
    /** 最小化窗口 */
    "min-window": {
      skipTaskBar?: boolean; // 是否隐藏任务栏
    };

    /** 关闭窗口 */
    "close-window": undefined;

    /** 刷新插件 */
    'refresh-plugins': undefined;
  }
}

/** 需要回执 */
declare namespace IpcInvoke {

  interface Renderer {
    "get-all-plugins": () => IPlugin.IPluginSerializable[];
    "call-plugin-method": <T extends keyof IPlugin.IPluginInstanceMethods>(arg: {
      // 通过hash或者platform查找插件
      hash?: string;
      platform?: string;
      // 方法
      method: T;
      // 参数
      args: Parameters<IPlugin.IPluginInstanceMethods[T]>;
    }) => ReturnType<IPlugin.IPluginInstanceMethods[T]>;
  }
}
