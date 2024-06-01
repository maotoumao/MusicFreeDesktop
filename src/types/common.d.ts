declare namespace ICommon {
  export type WithMusicList<T> = T & {
    musicList?: IMusic.IMusicItem[];
  };

  export type PaginationResponse<T> = {
    isEnd?: boolean;
    data?: T[];
  };

  interface IUpdateInfo {
    version: string;
    update?: {
      version: string;
      changeLog: string[];
      download: string[];
    };
  }

  interface IPoint {
    x: number;
    y: number;
  }

  interface IThemePack {
    /** 主题 */
    name: string;
    /** 加载之后的路径，内部属性 */
    path: string;
    /** 缩略图 */
    thumb?: string;
    /** 预览图 */
    preview: string;
    /** 主题更新链接 */
    srcUrl?: string;
    /** 主题作者 */
    author?: string;
    /** 版本号 */
    version?: string;
    description?: string;
    iframe?: Record<
      "app" | "header" | "body" | "music-bar" | "side-bar" | "page",
      string
    >;
  }

  interface IDownloadFileSize {
    /** 当前下载的大小 */
    currentSize?: number;
    /** 总大小 */
    totalSize?: number;
  }

  type ICommonReturnType = [
    boolean,
    {
      msg?: string;
      [k: string]: any;
    }?
  ];
}
