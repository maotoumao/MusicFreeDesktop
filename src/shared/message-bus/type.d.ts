import { PlayerState, RepeatMode } from "@/common/constant";
import type { IParsedLrcItem } from "@renderer/utils/lyric-parser";

export interface IAppState {
  musicItem?: IMusic.IMusicItem | null;
  playerState?: PlayerState;
  repeatMode?: RepeatMode;
  lyricText?: string | null;
  parsedLrc?: IParsedLrcItem | null;
  fullLyric?: IParsedLrcItem[] | null;
  progress?: number;
  duration?: number;
  /** 主题配色（跟随主题包），可视化窗口用它给效果上色 */
  themeColors?: IVisualization.IThemeColors;
}

export interface ICommand {
  /** 切换播放器状态 */
  TogglePlayerState: void;
  /** 切换上一首歌 */
  SkipToPrevious: void;
  /** 切换下一首歌 */
  SkipToNext: void;
  /** 快退 5 秒 */
  SeekBackward: void;
  /** 快进 5 秒 */
  SeekForward: void;
  /** 设置循环模式 */
  SetRepeatMode: RepeatMode;
  /** 播放音乐 */
  PlayMusic: IMusic.IMusicItem;
  /** 跳转路由 */
  Navigate: string;
  /** 声音调大 */
  VolumeUp: number;
  /** 声音调小 */
  VolumeDown: number;
  /** 切换喜爱状态 */
  ToggleFavorite: IMusic.IMusicItem | null;
  /** 切换桌面歌词状态 */
  ToggleDesktopLyric: void;
  /** 同步音乐状态 */
  SyncAppState: void;
  /** 打开音乐详情页面 */
  OpenMusicDetailPage: void;
  /** 切换主窗口显示 */
  ToggleMainWindowVisible: void;
  /**
   * 订阅频谱帧。
   * 可视化窗口用它登记订阅，之后才能收到 visualizationFrame 消息。
   */
  SubscribeVisualization: void;
}

// 内部使用的消息
// 其他窗口向主窗口发送的消息
export interface IPortMessagePayload<
  CommandKey extends keyof ICommand = keyof ICommand,
  StateKey extends keyof IAppState = keyof IAppState
> {
  mount: number;
  unmount: number;
  command: {
    command: CommandKey;
    data: ICommand[CommandKey];
  };
  subscribeAppState: StateKey[];
  ping: undefined;
  /**
   * 可视化窗口请求一帧音频数据（扩展窗口 → 主窗口）。
   *
   * 采用 **pull 模型**：由可见的可视化窗口用 rAF 拉帧，而不是主窗口推帧——
   * 主窗口最小化/隐藏时它的 rAF 会被节流到约 1fps，推帧恰好会在用户最想看
   * 可视化的时候冻住；反过来 IPC 回调不受节流影响。
   */
  requestFrame: undefined;
  /** 主窗口回的一帧音频分析数据（主窗口 → 扩展窗口） */
  visualizationFrame: IVisualization.IAudioFrame;
}

export interface IPortMessage<
  T extends keyof IPortMessagePayload = keyof IPortMessagePayload
> {
  type: T;
  payload: IPortMessagePayload[T];
  timestamp: number;
}
