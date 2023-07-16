interface IThemePack {
  name: string;
  path: string;
  preview: string;
}

interface IConfig {
  normal: {
    closeBehavior: "exit" | "minimize";

    checkUpdate: boolean;
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
  };
  lyric: {
    /** 显示桌面歌词 */
    enableDesktopLyric: boolean;
    /** 桌面歌词置顶 */
    alwaysOnTop: boolean;
    /** 锁定桌面歌词 */
    lockLyric: boolean;
    /** 字体颜色 */
    fontColor: string;
    /** 描边颜色 */
    strokeColor: string;

  },
  download: {
    /** 下载路径 */
    path: string;
    /** 默认下载音质 */
    defaultQuality: IMusic.IQualityKey;
    /** 默认下载音质缺失时 */
    whenQualityMissing: "higher" | "lower";
  };
  shortCut: {
    test: never;
  };
  backup: {
    test: never;
  };
  /** 本地音乐配置 */
  localMusic: {
    watchDir: string[];
  };
  /** 主题设置 */
  theme: {
    // 主题列表
    themePacks: IThemePack[],
    // 当前主题
    currentThemePack: IThemePack | null
  }

  /** 不需要用户配置的数据 */
  private: {
    lyricWindowPosition: {
      x: number;
      y: number;
    }
  }
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
