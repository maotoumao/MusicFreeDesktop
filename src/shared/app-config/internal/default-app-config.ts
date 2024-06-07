import { defaultFont } from "../../../common/constant";
import { IAppConfigKeyPath, IAppConfigKeyPathValue } from "../type";

type IDefaultAppConfig<T extends IAppConfigKeyPath> = {
  [K in T]?: IAppConfigKeyPathValue<K>;
};

const defaultAppConfig: IDefaultAppConfig<IAppConfigKeyPath> = {
  "playMusic.whenQualityMissing": "lower",
  "playMusic.defaultQuality": "standard",
  "playMusic.clickMusicList": "replace",
  "playMusic.caseSensitiveInSearch": false,
  "playMusic.playError": "skip",
  "playMusic.whenDeviceRemoved": "play",
  "normal.taskbarThumb": "window",
  "normal.closeBehavior": "minimize",
  "normal.checkUpdate": true,
  "normal.maxHistoryLength": 30,
  "download.defaultQuality": "standard",
  "download.whenQualityMissing": "lower",
  "lyric.enableDesktopLyric": false,
  "lyric.alwaysOnTop": false,
  "lyric.lockLyric": false,
  "lyric.fontData": defaultFont,
  "lyric.fontColor": "#fff",
  "lyric.strokeColor": "#b48f1d",
  "lyric.fontSize": 54,
  "shortCut.enableLocal": true,
  "shortCut.enableGlobal": false,
  "download.concurrency": 5,
  "normal.musicListColumnsShown": [] as any,
  "backup.resumeBehavior": "append",
} as const;

export default defaultAppConfig;
