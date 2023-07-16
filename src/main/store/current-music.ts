import Store from "@/common/store";
import { PlayerState, RepeatMode } from "@/renderer/core/track-player/enum";

export const currentMusicInfoStore = new Store<{
  currentMusic: IMusic.IMusicItem | null;
  currentPlayerState: PlayerState;
  currentRepeatMode: RepeatMode;
  lrc: ILyric.IParsedLrc
}>({
  currentMusic: null,
  currentPlayerState: PlayerState.Paused,
  currentRepeatMode: RepeatMode.Queue,
  lrc: []
});
