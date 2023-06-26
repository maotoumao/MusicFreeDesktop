declare namespace IpcEvents {
  // 由 Main 发出的ipc通信
  type Plugin = import("@main/core/plugin-manager/plugin").Plugin;
  type AppConfig = import("@/common/app-config/type").IAppConfig;
  interface Main {
    /** 插件 */
    "plugin-loaded": IPlugin.IPluginDelegate[];
    "sync-app-config": AppConfig;
    /** 切换播放状态 */
    "switch-music-state": import("@/renderer/core/track-player/enum").PlayerState;
    "skip-next": undefined;
    "skip-prev": undefined;
    "set-repeat-mode": import("@/renderer/core/track-player/enum").RepeatMode;
    navigate:
      | string
      | {
          url: string;
          payload?: any;
        };

    "sync-local-music": IMusic.IMusicItem[];

  }
}
