import Store from "@/common/store";
import {PlayerState, RepeatMode} from "@/common/constant";

export const currentMusicInfoStore = new Store<{
  currentMusic: IMusic.IMusicItem | null;
  currentPlayerState: PlayerState;
  currentRepeatMode: RepeatMode;
}>({
  currentMusic: null,
  currentPlayerState: PlayerState.Paused,
  currentRepeatMode: RepeatMode.Queue,
});
