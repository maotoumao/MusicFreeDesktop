declare namespace IMedia {
  export type SupportMediaItem = {
    music: IMusic.IMusicItem;
    album: IAlbum.IAlbumItem;
    artist: IArtist.IArtistItem;
    sheet: IMusic.IMusicSheetItem;
    lyric: ILyric.ILyricItem;
  };

  export type SupportMediaType = keyof SupportMediaItem;

  interface IUnique {
    /** 唯一id */
    id: string;
    $?: any;
    [k: string | number | symbol]: any;
  }

  /** 基础媒体类型 */
  interface IMediaBase extends IUnique {
    /** 媒体来源平台，如本地等 */
    platform: string;
    [k: string | number | symbol]: any;
  }
}

declare namespace IMusic {
  interface IMusicSource {
    /** 播放的http请求头 */
    headers?: Record<string, string>;
    /** 兜底播放 */
    url?: string;
    /** UA */
    userAgent?: string;
  }

  interface IMusicItem extends IMedia.IMediaBase {
    /** 作者 */
    artist: string;
    /** 歌曲标题 */
    title: string;
    /** 时长(s) */
    duration?: number;
    /** 专辑名 */
    album?: string;
    /** 专辑封面图 */
    artwork?: string;
    /** 默认音源 */
    url?: string;
    // todo: 格式化
    /** 歌词URL */
    lrc?: string;
    /** 歌词文本 */
    rawLrc?: string;
    // 其他
    [k: string | number | symbol]: any;
  }

  /** 用户手动改过的歌曲信息，只存被改过的字段 */
  interface IMusicMetaItem {
    platform: string;
    id: string;
    /** 歌曲标题 */
    title?: string;
    /** 作者 */
    artist?: string;
    /** 专辑名 */
    album?: string;
  }

  /** 歌曲挑定的 MV */
  interface IMusicMvItem {
    platform: string;
    id: string;
    /** 选中的 MV 条目 */
    mv: IMusicItem;
  }

  /** 校正后的歌曲时长（秒） */
  interface IMusicDurationItem {
    platform: string;
    id: string;
    /** 实际播放测得的时长（秒） */
    duration: number;
  }

  // 音乐的内部数据
  interface IMusicItemInternalData {
    downloadData?: {
      path: string;
      quality: IQualityKey;
      /**
       * 下载下来的文件明显不完整（时长远短于标称时长）。
       * 这种文件不能拿去播 —— 播到断点就没声音了，
       * 播放时会改用在线音源。
       */
      incomplete?: boolean;
    };
  }

  interface IMusicSheetItem extends IMedia.IMediaBase {
    /** 封面图 */
    artwork?: string;
    /** 标题 */
    title: string;
    /** 描述 */
    description?: string;
    /** 作品总数 */
    worksNum?: number;
    /** 播放次数 */
    playCount?: number;
    /** 播放列表 */
    musicList?: IMusicItem[];
    /** 歌单创建日期 */
    createAt?: number;
    // 歌单作者
    artist?: string;
  }

  /** 数据库中存储的歌单列表，其中音乐列表只存id */
  interface IDBMusicSheetItem extends IMusicSheetItem {
    musicList?: IMedia.IMediaBase[];
  }

  interface ILocalMusicList {
    folder: string;
    musicList: IMusic.IMusicItem[];
  }

  /** 歌单集合 */
  export interface IMusicSheetGroupItem {
    title?: string;
    data: Array<IMusicSheetItem>;
  }

  // 音质
  export type IQualityKey = "low" | "standard" | "high" | "super";

  type IMusicItemPartial = Partial<IMusicItem>;
}

declare namespace IAlbum {
  interface IAlbumItem extends IMusic.IMusicSheetItem {
    artwork?: string;
    title: string;
    date?: string;
    artist?: string;
    description: string;
    /** 专辑内有多少作品 */
    worksNum?: number;
    musicList?: IMusic.IMusicItem[];
  }
}

declare namespace IArtist {
  interface IArtistItem {
    name: string;
    id: string;
    fans?: number;
    description?: string;
    platform: string;
    avatar: string;
    musicList?: IMusic.IMusicItem[];
    albumList?: IAlbum.IAlbumItem[];
  }

  type ArtistMediaType = "music" | "album";
}

declare namespace ILyric {
  interface ILyricItem extends IMusic.IMusicItem {
    /** 歌词（无时间戳） */
    rawLrcTxt?: string;
  }

  interface ILyricSource {
    lrc?: string;
    rawLrc?: string;
    translation?: string;
    /**
     * 逐字歌词原文（带词级时间戳）
     * 格式支持增强型 LRC（<mm:ss.xx>）与 YRC/QRC（(start,duration,0)），
     * 没有时由应用侧按行均分生成伪逐字
     */
    wordLyric?: string;
  }
}

declare namespace IComment {
  interface ICommentItem {
    id?: string;
    // 用户名
    nickName: string;
    // 头像
    avatar?: string;
    // 评论内容
    comment: string;
    // 点赞数
    like?: number;
    // 评论时间
    createAt?: number;
    // 地址
    location?: string;
  }

  interface IComment extends ICommentItem {
    // 回复
    replies?: IComment[];
  }
}
