import {PlayerState, RepeatMode} from "@/common/constant";
import type {IParsedLrcItem} from "@renderer/utils/lyric-parser";

export interface IAppState {
    musicItem?: IMusic.IMusicItem | null;
    playerState?: PlayerState;
    repeatMode?: RepeatMode;
    lyricText?: string | null;
    parsedLrc?: IParsedLrcItem | null;
    progress?: number;
    duration?: number;
}

export interface ICommand {
    /** 切换播放器状态 */
    TogglePlayerState: void;
    /** 切换上一首歌 */
    SkipToPrevious: void;
    /** 切换下一首歌 */
    SkipToNext: void;
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
}


// 内部使用的消息
// 其他窗口向主窗口发送的消息
export interface IPortMessagePayload<CommandKey extends keyof ICommand = keyof ICommand, StateKey extends keyof IAppState = keyof IAppState> {
    mount: number;
    unmount: number;
    command: {
        command: CommandKey,
        data: ICommand[CommandKey]
    },
    subscribeAppState: StateKey[]
}

export interface IPortMessage<T extends keyof IPortMessagePayload = keyof IPortMessagePayload> {
    type: T,
    payload: IPortMessagePayload[T],
    timestamp: number
}
