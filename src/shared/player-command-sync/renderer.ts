// 给扩展窗口用的
import Store from "@/common/store";
import MessageHub from "../message-hub/renderer";
import { PlayerState, RepeatMode } from "@/renderer/core/track-player/enum";
import { TrackPlayerSyncType } from "@/common/constant";

export function sendCommand<T extends keyof ICommon.ICommand>(
  type: T,
  data?: ICommon.ICommand[T]
) {
  MessageHub.sendToCenter({
    cmd: type,
    data,
  });
}

const currentMusicItemStore = new Store<IMusic.IMusicItem | null>(null);
const playerStateStore = new Store<PlayerState>(PlayerState.None);
const repeatModeStore = new Store<RepeatMode>(RepeatMode.Queue);
const lyricStore = new Store<ILyric.IParsedLrcItem[] | null>(null);
const currentLyricStore = new Store<{
  lrc: ILyric.IParsedLrcItem;
  index: number;
} | null>(null);
const currentProgressStore = new Store<{
  currentTime: number;
  duration: number;
}>({
  currentTime: 0,
  duration: 0,
});

//@ts-ignore
window.playerState = playerStateStore;

export function setupPlayerStateSync() {
  MessageHub.on("data", (raw) => {
    const type: TrackPlayerSyncType = raw?.type;
    const data = raw?.data || {};

    switch (type) {
      case TrackPlayerSyncType.MusicChanged:
        currentMusicItemStore.setValue(data);
        break;
      case TrackPlayerSyncType.CurrentLyricChanged:
        currentLyricStore.setValue(data);
        break;
      case TrackPlayerSyncType.LyricChanged:
        lyricStore.setValue(data);
        break;
      case TrackPlayerSyncType.PlayerStateChanged:
        playerStateStore.setValue(data);
        break;
      case TrackPlayerSyncType.ProgressChanged:
        currentProgressStore.setValue(data);
        break;
      case TrackPlayerSyncType.RepeatModeChanged:
        repeatModeStore.setValue(data);
        break;
      case TrackPlayerSyncType.SyncPlayerState:
        currentMusicItemStore.setValue(data.music);
        currentLyricStore.setValue(data.currentLyric);
        lyricStore.setValue(data.lyric);
        playerStateStore.setValue(data.playerState);
        currentProgressStore.setValue(data.progress);
        repeatModeStore.setValue(data.repeatMode);
        break;
    }
  });

  MessageHub.sendToCenter({
    type: "ready",
  });
}

export const PlayerSyncStore = {
  currentMusicItemStore,
  playerStateStore,
  repeatModeStore,
  lyricStore,
  currentLyricStore,
  currentProgressStore,
};
