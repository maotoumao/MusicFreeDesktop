interface IConfig {
  normal: {
    closeBehavior: "exit" | "minimize";
    maxHistoryLength: number;
    checkUpdate: boolean;
    taskbarThumb: "window" | "artwork";
    musicListColumnsShown: Array<"duration" | "platform">;
    language: string;
  };
  playMusic: {
    /** 歌单内搜索区分大小写 */
    caseSensitiveInSearch: boolean;
    /** 默认播放音质 */
    defaultQuality: IMusic.IQualityKey;
    /** 默认播放音质缺失时 */
    whenQualityMissing: "higher" | "lower";
    /** 双击音乐列表时 */
    clickMusicList: "normal" | "replace";
    /** 播放失败时 */
    playError: "pause" | "skip";
    /** 输出设备 */
    audioOutputDevice: MediaDeviceInfo | null;
    /** 设备变化时 */
    whenDeviceRemoved: "pause" | "play";
  };
  lyric: {
    /** [darwin only] 显示状态栏歌词 */
    enableStatusBarLyric: boolean;
    /** 显示桌面歌词 */
    enableDesktopLyric: boolean;
    /** 桌面歌词置顶 */
    alwaysOnTop: boolean;
    /** 锁定桌面歌词 */
    lockLyric: boolean;
    /** 字体 */
    fontData: FontData;
    /** 字体颜色 */
    fontColor: string;
    /** 字体大小 */
    fontSize: number;
    /** 描边颜色 */
    strokeColor: string;
  };
  shortCut: {
    enableLocal: boolean;
    enableGlobal: boolean;
    shortcuts: Record<
      | "play/pause"
      | "skip-previous"
      | "skip-next"
      | "toggle-desktop-lyric"
      | "volume-up"
      | "volume-down"
      | "like/dislike",
      {
        local?: string[] | null;
        global?: string[] | null;
      }
    >;
  };
  download: {
    /** 下载路径 */
    path: string;
    /** 默认下载音质 */
    defaultQuality: IMusic.IQualityKey;
    /** 默认下载音质缺失时 */
    whenQualityMissing: "higher" | "lower";
    /** 最多同时下载 */
    concurrency: number;
  };
  plugin: {
    autoUpdatePlugin: boolean; // 是否自动升级插件
    notCheckPluginVersion: boolean; // 是否不检测插件版本
  };
  network: {
    proxy: {
      /** 是否启用代理 */
      enabled: boolean;
      /** 主机 */
      host?: string;
      /** 端口 */
      port?: string;
      /** 账号 */
      username?: string;
      /** 密码 */
      password?: string;
    };
  };

  backup: {
    /** 恢复歌单时行为 */
    resumeBehavior: "append" | "overwrite";
    webdav: {
      url: string;
      username: string;
      password: string;
    };
  };
  /** 本地音乐配置 */
  localMusic: {
    watchDir: string[];
  };
  /** 主题设置 */
  theme: {
    test: never;
  };

  /** 不需要用户配置的数据 */
  private: {
    lyricWindowPosition: ICommon.IPoint;
    minimodeWindowPosition: ICommon.IPoint;
    pluginMeta: Record<string, IPlugin.IPluginMeta>;
    minimode: boolean;
  };
}

type BasicType = string | number | symbol | null | undefined;

/** 路径 */
type KeyPaths<
  T extends object,
  Root extends boolean = true,
  K extends keyof T = keyof T
> = T extends BasicType
  ? never
  : T extends (infer Arr)[]
  ?
      | `${Root extends true ? `${number}` : `.${number}`}`
      | `${Root extends true ? `${number}` : `.${number}`}${KeyPaths<
          Arr,
          false
        >}`
  : K extends string | number
  ?
      | (Root extends true ? `${K}` : `.${K}`)
      | (T[K] extends Record<string | number, any>
          ? `${Root extends true ? `${K}` : `.${K}`}${KeyPaths<T[K], false>}`
          : never)
  : never;

type KeyPathValue<T extends object, K extends string> = T extends Record<
  string | number,
  any
>
  ? K extends `${infer S}.${infer R}`
    ? KeyPathValue<T[S], R>
    : T[K]
  : never;

/** 所有配置都是可选的 */
export type IAppConfig = Partial<IConfig>;
export type IAppConfigKeyPath = KeyPaths<IConfig>;
export type IAppConfigKeyPathValue<KeyPath> = KeyPathValue<IAppConfig, KeyPath>;
