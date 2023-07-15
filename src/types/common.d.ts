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
    }
  }

  interface ISendToLyricWindowData {
    // 时序
    timeStamp: number;
    lrc: ILyric.IParsedLrcItem[]
  }

  interface IPoint {
    x: number;
    y: number
  }
}
