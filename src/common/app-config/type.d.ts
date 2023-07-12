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
  download: {
    /** 下载路径 */
    path: string;
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
