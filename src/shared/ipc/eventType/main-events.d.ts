declare namespace IpcEvents {
  type IPlayerCmd =
    | "skip-prev"
    | "skip-next"
    | "set-repeat-mode"
    | "set-player-state";
  // 由 Main 发出的ipc通信
  type Plugin = import("@main/core/plugin-manager/plugin").Plugin;
  type AppConfig = import("@/shared/app-config/type").IAppConfig;

  type IExtensionWindowSyncData = {
    timeStamp: number;
    data: Partial<{
      // 同步歌词
      lrc: import("@/renderer/utils/lyric-parser").IParsedLrcItem[];
      // 播放状态
      playerState: import("@/renderer/core/track-player/enum").PlayerState;
      // 当前音乐
      currentMusic: IMusic.IMusicItem;
    }>;
  };
  interface Main {
    /** 插件 */
    "plugin-loaded": IPlugin.IPluginDelegate[];
    "sync-app-config": AppConfig;
    /** 切换播放状态 */
    "player-cmd": {
      cmd: IPlayerCmd;
      payload?: any;
    };
    navigate:
      | string
      | {
          url: string;
          payload?: any;
        };

    "sync-local-music": IMusic.IMusicItem[];

    // 向扩展进程同步数据
    "sync-extension-data": IExtensionWindowSyncData;
  }
}
