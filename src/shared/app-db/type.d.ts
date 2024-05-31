interface ILocalMusic {
  /** 获取本地音乐 */
  getMusicList: () => IMusic.IMusicItem[];
  /** 添加到本地音乐列表 */
  addMusicToSheet: (
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
  ) => boolean;
  /** 从本地音乐列表中移除 */
  removeMusicFromSheet: (
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
  ) => boolean;
}

interface IMediaMeta {
  getMediaMeta: <T = any>(
    mediaItem: IMedia.IMediaBase,
    type: IMedia.SupportMediaType = "music"
  ) => T;
  setMediaMeta: <T = any>(
    mediaItem: IMedia.IMediaBase,
    meta: T,
    type: IMedia.SupportMediaType = "music"
  ) => boolean;
}

interface IMusicSheet {
  getSheetMusicList: (
    sheetId: string,
    desc?: boolean
  ) => Array<IMusic.IMusicItem>;
  getSheetItem: (sheetId: string) => IMusic.IMusicSheetItem | null;
  /** 获取全部歌单的简略信息 */
  removeAllMusic: (sheetId: string) => boolean;
  getAllSheets: () => Array<IMusic.IMusicSheetItem>;
  createSheet: (sheetName: string) => string | null;
  removeSheet: (sheetId: string) => boolean;
  addMusicToSheet: (
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
    sheetId: string
  ) => boolean;
  removeMusicFromSheet: (
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
    sheetId: string
  ) => boolean;
}

export interface IMod {
  musicSheet: IMusicSheet;
  localMusic: ILocalMusic;
  mediaMeta: IMediaMeta;
}
