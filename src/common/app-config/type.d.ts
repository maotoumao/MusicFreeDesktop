interface IConfig {
  setting: number;
  setting1: boolean;
  setting2: string;
  setting3: {
    dog: string;
    dog1: {
      a: number;
      b: boolean;
    };
  };
  setting4: Array<{
    dog6: "ss" | "dff";
    dog7: boolean;
  }>;
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

const ff: IAppConfigKeyPath = "setting4.66.dog7";
